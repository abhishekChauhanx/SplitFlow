import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { splitEqual, splitByShares } from "@/lib/split-logic";

export async function POST() {
  const now = new Date();

  // Only run ACTIVE templates that are due — skip paused ones
  const dueTemplates = await prisma.recurringTemplate.findMany({
    where: { active: true, nextRunAt: { lte: now } },
  });

  const results = [];

  for (const template of dueTemplates) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: template.groupId },
    });

    let memberIds = members.map((m) => m.userId);

    // Read override if present
    const override = template.nextCycleOverride as Record<string, any> | null;

    // Exclude members specified in override (e.g. someone who left mid-month)
    if (override?.excludeUserIds?.length > 0) {
      memberIds = memberIds.filter(
        (uid) => !override.excludeUserIds.includes(uid)
      );
    }

    if (memberIds.length === 0) {
      // Skip empty groups — update nextRunAt anyway so it doesn't stay stuck
      await prisma.recurringTemplate.update({
        where: { id: template.id },
        data: {
          nextRunAt: new Date(
            template.nextRunAt.getTime() + template.frequencyDays * 86400000
          ),
        },
      });
      continue;
    }

    const payerId = memberIds[0];

    // Use override amount if set, otherwise use template default
    const amountPaise = override?.amountPaise ?? template.amountPaise;

    // Use override shareUnits if set, otherwise use template default
    const shareUnits = (override?.shareUnits ?? template.shareUnits) as
      | Record<string, number>
      | null;

    let splits;
    if (template.splitType === "SHARES" && shareUnits) {
      // Filter share units to only current (non-excluded) members
      const filteredShares = Object.fromEntries(
        Object.entries(shareUnits).filter(([uid]) => memberIds.includes(uid))
      );
      splits = splitByShares(amountPaise, filteredShares, payerId);
    } else {
      splits = splitEqual(amountPaise, memberIds, payerId);
    }

    // Add note to description if this was a prorated cycle
    const description = override?.note
      ? `${template.description} (${override.note})`
      : template.description;

    const expense = await prisma.expense.create({
      data: {
        groupId: template.groupId,
        description,
        amountPaise,
        paidById: payerId,
        createdById: payerId,
        splitType: template.splitType,
        splits: { create: splits },
        recurringTemplateId: template.id,
      },
    });

    // Push nextRunAt forward by frequencyDays
    const nextRunAt = new Date(
      template.nextRunAt.getTime() + template.frequencyDays * 86400000
    );

    // Clear the one-time override after using it
    await prisma.recurringTemplate.update({
      where: { id: template.id },
      data: {
        nextRunAt,
        nextCycleOverride: null, // consumed — revert to normal next cycle
      },
    });

    results.push({ expenseId: expense.id, description, amountPaise });
  }

  return NextResponse.json({
    generated: results.length,
    expenses: results,
  });
}