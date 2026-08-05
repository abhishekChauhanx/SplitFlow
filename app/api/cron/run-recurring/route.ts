import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { splitEqual, splitByShares } from "@/lib/split-logic";

export async function POST() {
  const now = new Date();
  const dueTemplates = await prisma.recurringTemplate.findMany({
    where: { active: true, nextRunAt: { lte: now } },
  });

  const results = [];

  for (const template of dueTemplates) {
    // Always fetch CURRENT members at generation time — this is what makes
    // mid-cycle member joins/leaves work correctly: someone who joined last
    // week is automatically included in this month's rent split, and someone
    // who left is automatically excluded, with no manual adjustment needed.
    const members = await prisma.groupMember.findMany({ where: { groupId: template.groupId } });
    const memberIds = members.map((m) => m.userId);

    if (memberIds.length === 0) continue; // skip empty groups

    // Recurring expenses need a designated payer; using the first member as a
    // simple default. A real app might let the template specify who pays each cycle.
    const payerId = memberIds[0];

    let splits;
    if (template.splitType === "SHARES" && template.shareUnits) {
      const shareUnits = template.shareUnits as Record<string, number>;
      // Only include current members in the share calculation, in case someone left
      const filteredShares = Object.fromEntries(
        Object.entries(shareUnits).filter(([userId]) => memberIds.includes(userId))
      );
      splits = splitByShares(template.amountPaise, filteredShares, payerId);
    } else {
      splits = splitEqual(template.amountPaise, memberIds, payerId);
    }

    const expense = await prisma.expense.create({
      data: {
        groupId: template.groupId,
        description: template.description,
        amountPaise: template.amountPaise,
        paidById: payerId,
        splitType: template.splitType,
        splits: { create: splits },
      },
    });

    const nextRunAt = new Date(template.nextRunAt);
    nextRunAt.setDate(nextRunAt.getDate() + template.frequencyDays);

    await prisma.recurringTemplate.update({
      where: { id: template.id },
      data: { nextRunAt },
    });

    results.push(expense);
  }

  return NextResponse.json({ generated: results.length, expenses: results });
}