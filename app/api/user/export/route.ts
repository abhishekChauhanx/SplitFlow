import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      upiId: true,
      createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // All groups the user is part of
  const groups = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        select: { id: true, name: true, createdAt: true },
      },
    },
  });

  // All expenses the user paid for
  const expensesPaid = await prisma.expense.findMany({
    where: { paidById: userId },
    select: {
      id: true,
      description: true,
      amountPaise: true,
      splitType: true,
      createdAt: true,
      group: { select: { name: true } },
    },
  });

  // All expense splits the user owes
  const splits = await prisma.expenseSplit.findMany({
    where: { userId },
    select: {
      amountOwedPaise: true,
      expense: {
        select: {
          description: true,
          amountPaise: true,
          createdAt: true,
          group: { select: { name: true } },
        },
      },
    },
  });

  // All settlements sent by the user
  const settlementsSent = await prisma.settlement.findMany({
    where: { fromUserId: userId },
    select: {
      amountPaise: true,
      status: true,
      paymentMethod: true,
      utrNumber: true,
      createdAt: true,
      payerConfirmedAt: true,
      payeeConfirmedAt: true,
    },
  });

  // All settlements received by the user
  const settlementsReceived = await prisma.settlement.findMany({
    where: { toUserId: userId },
    select: {
      amountPaise: true,
      status: true,
      paymentMethod: true,
      utrNumber: true,
      createdAt: true,
      payerConfirmedAt: true,
      payeeConfirmedAt: true,
    },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    notice: "This is all personal data SplitFlow holds about you, exported under the DPDP Act 2023.",
    profile: user,
    groups: groups.map((g) => ({
      groupId: g.group.id,
      groupName: g.group.name,
      joinedAt: g.joinedAt,
      groupCreatedAt: g.group.createdAt,
    })),
    expensesPaid: expensesPaid.map((e) => ({
      description: e.description,
      group: e.group.name,
      amountRupees: (e.amountPaise / 100).toFixed(2),
      splitType: e.splitType,
      date: e.createdAt,
    })),
    expenseSplits: splits.map((s) => ({
      expenseDescription: s.expense.description,
      group: s.expense.group.name,
      amountOwedRupees: (s.amountOwedPaise / 100).toFixed(2),
      date: s.expense.createdAt,
    })),
    settlementsSent: settlementsSent.map((s) => ({
      amountRupees: (s.amountPaise / 100).toFixed(2),
      method: s.paymentMethod,
      utrNumber: s.utrNumber || null,
      status: s.status,
      createdAt: s.createdAt,
      payerConfirmedAt: s.payerConfirmedAt,
      payeeConfirmedAt: s.payeeConfirmedAt,
    })),
    settlementsReceived: settlementsReceived.map((s) => ({
      amountRupees: (s.amountPaise / 100).toFixed(2),
      method: s.paymentMethod,
      utrNumber: s.utrNumber || null,
      status: s.status,
      createdAt: s.createdAt,
      payerConfirmedAt: s.payerConfirmedAt,
      payeeConfirmedAt: s.payeeConfirmedAt,
    })),
  };

  // Return as a downloadable JSON file
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="splitflow-data-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}