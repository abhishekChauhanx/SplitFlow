import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;

  const collection = await prisma.vendorCollection.findUnique({
    where: { id: collectionId },
    include: {
      vendor: { include: { user: { select: { name: true } } } },
      subscribers: { include: { payment: true } },
    },
  });

  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(collection);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const collection = await prisma.vendorCollection.findUnique({
    where: { id: collectionId },
    include: { subscribers: { include: { payment: true } } },
  });
  if (!collection || collection.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const {
    title,
    amountPaise,
    dueDate,
    addSubscribers = [],
    updateSubscribers = [],
    removeSubscriberIds = [],
  } = await req.json();

  // Block removing anyone who already has a payment on file
  const blocked = collection.subscribers.filter(
    (s) => removeSubscriberIds.includes(s.id) && s.payment
  );
  if (blocked.length > 0) {
    return NextResponse.json(
      { error: `Can't remove subscribers with a recorded payment: ${blocked.map((s) => s.name).join(", ")}` },
      { status: 400 }
    );
  }

  // Validate the resulting email set has no duplicates
  const finalEmails = collection.subscribers
    .filter((s) => !removeSubscriberIds.includes(s.id))
    .map((s) => {
      const upd = updateSubscribers.find((u: any) => u.id === s.id);
      return upd?.email !== undefined ? upd.email?.trim().toLowerCase() || null : s.email?.toLowerCase() || null;
    })
    .concat(addSubscribers.map((a: any) => a.email?.trim().toLowerCase() || null))
    .filter((e: string | null): e is string => !!e);

  const dupe = finalEmails.find((e, i) => finalEmails.indexOf(e) !== i);
  if (dupe) {
    return NextResponse.json({ error: `Duplicate email: ${dupe}` }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (title !== undefined || amountPaise !== undefined || dueDate !== undefined) {
        await tx.vendorCollection.update({
          where: { id: collectionId },
          data: {
            ...(title !== undefined ? { title } : {}),
            ...(amountPaise !== undefined ? { amountPaise } : {}),
            ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          },
        });
      }

      for (const id of removeSubscriberIds) {
        await tx.vendorSubscriber.delete({ where: { id } });
      }

      for (const u of updateSubscribers) {
        await tx.vendorSubscriber.update({
          where: { id: u.id },
          data: {
            ...(u.name !== undefined ? { name: u.name.trim() } : {}),
            ...(u.email !== undefined ? { email: u.email?.trim().toLowerCase() || null } : {}),
            ...(u.phone !== undefined ? { phone: u.phone?.trim() || null } : {}),
          },
        });
      }

      for (const a of addSubscribers) {
        if (!a.name?.trim()) continue;
        await tx.vendorSubscriber.create({
          data: {
            collectionId,
            name: a.name.trim(),
            email: a.email?.trim().toLowerCase() || null,
            phone: a.phone?.trim() || null,
          },
        });
      }
    });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Duplicate email among subscribers" }, { status: 409 });
    }
    throw e;
  }

  const updated = await prisma.vendorCollection.findUnique({
    where: { id: collectionId },
    include: { subscribers: { include: { payment: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const collection = await prisma.vendorCollection.findUnique({
    where: { id: collectionId },
    include: { subscribers: { include: { payment: true } } },
  });
  if (!collection || collection.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasAnyPayment = collection.subscribers.some((s) => s.payment);
  if (hasAnyPayment) {
    return NextResponse.json(
      { error: "Can't delete a collection that already has payments recorded" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.vendorSubscriber.deleteMany({ where: { collectionId } }),
    prisma.vendorCollection.delete({ where: { id: collectionId } }),
  ]);

  return NextResponse.json({ ok: true });
}