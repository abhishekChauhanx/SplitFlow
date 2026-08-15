import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const userId = await getSessionUserId();

  const collection = await prisma.vendorCollection.findUnique({
    where: { token },
    include: {
      vendor: { include: { user: { select: { name: true } } } },
      subscribers: { include: { payment: true } },
    },
  });

  if (!collection) return NextResponse.json({ error: "Invalid collection link" }, { status: 404 });

  // Since proxy.ts now blocks /pay/[token] for unauthenticated visitors,
  // userId should always be set here — but check defensively anyway.
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const mySubscription = collection.subscribers.find((s) => s.userId === userId);

  return NextResponse.json({
    collectionId: collection.id,
    title: collection.title,
    amountPaise: collection.amountPaise,
    dueDate: collection.dueDate,
    vendorName: collection.vendor.businessName,
    vendorUpiId: collection.vendor.upiId,
    subscriberCount: collection.subscribers.length,
    paidCount: collection.subscribers.filter(
      (s) => s.payment?.status === "paid" || s.payment?.status === "confirmed"
    ).length,
    myPaymentStatus: mySubscription?.payment?.status || null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const collection = await prisma.vendorCollection.findUnique({
      where: { token },
      include: { subscribers: { include: { payment: true } } },
    });

    if (!collection) {
      return NextResponse.json({ error: "Invalid collection link" }, { status: 404 });
    }

    const { utrNumber, paymentMethod } = await req.json();

    // 1. Already claimed by this exact user? Use that record.
    let subscriber = collection.subscribers.find((s) => s.userId === userId) || null;

    // 2. Not yet claimed — check if the vendor pre-invited this person's email.
    //    If so, CLAIM that pending row instead of creating a new one.
    if (!subscriber && user.email) {
      const pendingInvite = collection.subscribers.find(
        (s) => !s.userId && s.invitedEmail?.toLowerCase() === user.email!.toLowerCase()
      );
      if (pendingInvite) {
        subscriber = await prisma.vendorSubscriber.update({
          where: { id: pendingInvite.id },
          data: { userId, name: user.name || user.email }, // fill in real name/account now
          include: { payment: true },
        });
      }
    }

    // 3. No existing or pending record — only allow a brand-new subscriber
    //    if this collection is open enrollment.
    if (!subscriber) {
      if (!collection.openEnrollment) {
        return NextResponse.json(
          { error: "This collection is invite-only. Ask the vendor to add you as a subscriber first." },
          { status: 403 }
        );
      }
      subscriber = await prisma.vendorSubscriber.create({
        data: {
          collectionId: collection.id,
          userId,
          name: user.name || user.email || "Unknown",
        },
        include: { payment: true },
      });
    }

    if (subscriber.payment) {
      return NextResponse.json(
        { error: "You've already recorded a payment for this collection" },
        { status: 409 }
      );
    }

    const payment = await prisma.vendorPayment.create({
      data: {
        collectionId: collection.id,
        subscriberId: subscriber.id,
        amountPaise: collection.amountPaise,
        paymentMethod: paymentMethod === "cash" ? "cash" : "upi",
        utrNumber: utrNumber || null,
        status: "paid",
        paidAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, payment });
  } catch (err) {
    console.error("Vendor payment recording failed:", err);
    return NextResponse.json(
      { error: "Something went wrong recording your payment. Please try again." },
      { status: 500 }
    );
  }
}