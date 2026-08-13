import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

// GET — preview the collection, optionally check a specific email's status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const emailParam = req.nextUrl.searchParams.get("email");
  const email = emailParam?.trim().toLowerCase() || null;

  const collection = await prisma.vendorCollection.findUnique({
    where: { token },
    include: {
      vendor: { include: { user: { select: { name: true, email: true } } } },
      subscribers: { include: { payment: true } },
    },
  });

  if (!collection) return NextResponse.json({ error: "Invalid collection link" }, { status: 404 });

  let emailStatus: { alreadyPaid: boolean; subscriberName: string } | null = null;
  if (email) {
    const match = collection.subscribers.find((s) => s.email?.toLowerCase() === email);
    if (match) {
      emailStatus = {
        alreadyPaid: match.payment?.status === "paid" || match.payment?.status === "confirmed",
        subscriberName: match.name,
      };
    }
  }

  return NextResponse.json({
    collectionId: collection.id,
    title: collection.title,
    amountPaise: collection.amountPaise,
    dueDate: collection.dueDate,
    vendorName: collection.vendor.businessName,
    vendorUpiId: collection.vendor.upiId,
    subscriberCount: collection.subscribers.length,
    paidCount: collection.subscribers.filter((s) => s.payment?.status === "paid" || s.payment?.status === "confirmed").length,
    emailStatus,
  });
}

// POST — record a payment, matched/deduped by email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const userId = await getSessionUserId();

  const collection = await prisma.vendorCollection.findUnique({
    where: { token },
    include: { subscribers: { include: { payment: true } } },
  });
  if (!collection) return NextResponse.json({ error: "Invalid collection link" }, { status: 404 });

  const { subscriberId, amountPaise, paymentMethod, utrNumber, name, email } = await req.json();
  const normalizedEmail = email?.trim().toLowerCase() || null;

  let subscriber;

  if (subscriberId) {
    subscriber = collection.subscribers.find((s) => s.id === subscriberId);
    if (!subscriber) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  } else if (userId) {
    // Logged-in user — match by userId first, then by email (vendor may have pre-added them)
    subscriber = collection.subscribers.find((s) => s.userId === userId);
    if (!subscriber) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const userEmail = user?.email?.toLowerCase() || null;
      const byEmail = userEmail
        ? collection.subscribers.find((s) => s.email?.toLowerCase() === userEmail)
        : null;

      subscriber = byEmail
        ? await prisma.vendorSubscriber.update({ where: { id: byEmail.id }, data: { userId } })
        : await prisma.vendorSubscriber.create({
            data: {
              collectionId: collection.id,
              userId,
              name: user?.name || user?.email || "Unknown",
              email: userEmail,
            },
          });
    }
  } else {
    // Public link, not logged in — name + email both required
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!normalizedEmail) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const existing = collection.subscribers.find((s) => s.email?.toLowerCase() === normalizedEmail);

    if (existing) {
      subscriber = existing;
    } else {
      try {
        subscriber = await prisma.vendorSubscriber.create({
          data: { collectionId: collection.id, name: name.trim(), email: normalizedEmail },
        });
      } catch (e: any) {
        if (e.code === "P2002") {
          return NextResponse.json({ error: "This email is already registered for this collection" }, { status: 409 });
        }
        throw e;
      }
    }
  }

  const existingPayment = await prisma.vendorPayment.findUnique({ where: { subscriberId: subscriber.id } });
  if (existingPayment) {
    return NextResponse.json({ error: "A payment for this email has already been recorded" }, { status: 409 });
  }

  const payment = await prisma.vendorPayment.create({
    data: {
      collectionId: collection.id,
      subscriberId: subscriber.id,
      amountPaise: amountPaise || collection.amountPaise,
      paymentMethod: paymentMethod || "upi",
      utrNumber: utrNumber || null,
      status: "paid",
      paidAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, payment });
}