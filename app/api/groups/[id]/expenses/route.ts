import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { splitEqual, splitExact, splitByPercentage, splitByShares } from "@/lib/split-logic";
import { sendPushToGroup } from "@/lib/webpush";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenses = await prisma.expense.findMany({
    where: { groupId: id },
    include: {
      paidBy: true,
      createdBy: true,
      splits: { include: { user: true } },
      payments: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const {
    description,
    amountPaise,
    paidById,
    splitType,
    exactAmounts,
    percentages,
    shareUnits,
    confirmDuplicate,
    confirmMerge,
    clientId, // NEW — idempotency key from offline queue / any client-side retry
  } = await req.json();

  // ── NEW: idempotency check, runs before anything else ──
  // If this exact client-generated request already succeeded (e.g. a retry
  // after a dropped connection, or an offline-queued expense being synced),
  // return the existing expense instead of creating — or merging — a duplicate.
  if (clientId) {
    const existing = await prisma.expense.findUnique({
      where: { clientId },
      include: { splits: true, payments: true },
    });
    if (existing) {
      return NextResponse.json(existing);
    }
  }

  const trimmedDescription = (description || "").trim();
  const effectiveSplitType = splitType || "EQUAL";

  // ── Merge-by-description (Equal split only for now) ──
  if (trimmedDescription && effectiveSplitType === "EQUAL") {
    const existing = await prisma.expense.findFirst({
      where: {
        groupId: id,
        splitType: "EQUAL",
        description: { equals: trimmedDescription, mode: "insensitive" },
      },
      include: { payments: true },
    });

    if (existing) {
      if (!confirmMerge) {
        const newTotal = existing.amountPaise + amountPaise;
        return NextResponse.json(
          {
            mergeCandidate: true,
            existingExpenseId: existing.id,
            existingAmountPaise: existing.amountPaise,
            incomingAmountPaise: amountPaise,
            newTotalPaise: newTotal,
            message: `"${trimmedDescription}" already exists (₹${(existing.amountPaise / 100).toFixed(2)}). Merge your ₹${(amountPaise / 100).toFixed(2)} into it? New total will be ₹${(newTotal / 100).toFixed(2)}.`,
          },
          { status: 409 }
        );
      }

      const members = await prisma.groupMember.findMany({ where: { groupId: id } });
      const memberIds = members.map((m) => m.userId);

      const updated = await prisma.$transaction(async (tx) => {
        if (existing.payments.length === 0) {
          await tx.expensePayment.create({
            data: { expenseId: existing.id, userId: existing.paidById, amountPaise: existing.amountPaise },
          });
        }

        await tx.expensePayment.upsert({
          where: { expenseId_userId: { expenseId: existing.id, userId: paidById } },
          create: { expenseId: existing.id, userId: paidById, amountPaise },
          update: { amountPaise: { increment: amountPaise } },
        });

        const newTotal = existing.amountPaise + amountPaise;
        const newSplits = splitEqual(newTotal, memberIds, existing.createdById);

        await tx.expenseSplit.deleteMany({ where: { expenseId: existing.id } });

        return tx.expense.update({
          where: { id: existing.id },
          data: {
            amountPaise: newTotal,
            paidById,
            splits: { create: newSplits },
          },
          include: { splits: true, payments: true, paidBy: true, createdBy: true },
        });
      });

      return NextResponse.json(updated);
    }
  }

  // ── Existing accidental-duplicate-submission protection ──
  if (!confirmDuplicate) {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const possibleDuplicate = await prisma.expense.findFirst({
      where: {
        groupId: id,
        amountPaise,
        paidById,
        description,
        createdAt: { gte: twoMinAgo },
      },
    });
    if (possibleDuplicate) {
      return NextResponse.json(
        { warning: "duplicate", message: "A very similar expense was just added. Add anyway?" },
        { status: 409 }
      );
    }
  }

  const members = await prisma.groupMember.findMany({ where: { groupId: id } });
  const memberIds = members.map((m) => m.userId);

  let splits;
  try {
    if (splitType === "EXACT") {
      splits = splitExact(amountPaise, exactAmounts);
    } else if (splitType === "PERCENTAGE") {
      splits = splitByPercentage(amountPaise, percentages, paidById);
    } else if (splitType === "SHARES") {
      splits = splitByShares(amountPaise, shareUnits, paidById);
    } else {
      splits = splitEqual(amountPaise, memberIds, paidById);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      groupId: id,
      description,
      amountPaise,
      paidById,
      createdById: userId,
      splitType: splitType || "EQUAL",
      clientId: clientId || null, // NEW
      splits: { create: splits },
      payments: { create: [{ userId: paidById, amountPaise }] },
    },
    include: { splits: true, payments: true },
  });

  await sendPushToGroup(id, userId, {
    title: "New expense added",
    body: `${expense.description} — ₹${(expense.amountPaise / 100).toFixed(2)}`,
    url: `/groups/${id}`,
  }).catch(() => {});

  return NextResponse.json(expense);
}