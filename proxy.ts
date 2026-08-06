import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;

  let isValidSession = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  // Already logged in → skip login page
  if (pathname === "/login" && isValidSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Public paths — don't require login
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/join/"); // invite pages are public

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