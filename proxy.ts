import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;

  let isValidSession = false;
  let userId: string | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      userId = payload.userId as string;
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  // Check if account was deleted — block even valid sessions
  if (isValidSession && userId && !pathname.startsWith("/account-deleted")) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isDeleted: true },
      });
      if (user?.isDeleted) {
        return NextResponse.redirect(new URL("/account-deleted", req.url));
      }
    } catch {
      // If DB check fails, don't block — fail open
    }
  }

  // Already logged in → skip login page
  if (pathname === "/login" && isValidSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isPublic =
    pathname === "/login" ||
    pathname === "/account-deleted" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/pay/");

  if (!isPublic && !isValidSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};