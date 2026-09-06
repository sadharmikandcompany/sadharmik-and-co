import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthed = verifySession(token);

  if (request.nextUrl.pathname === "/login") {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/pos/:path*",
    "/sales/:path*",
    "/purchases/:path*",
    "/vendors/:path*",
    "/users/:path*",
    "/delivery-partners/:path*",
    "/route-assignments/:path*",
    "/warehouses/:path*",
  ],
};
