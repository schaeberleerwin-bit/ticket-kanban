import { NextRequest, NextResponse } from "next/server";
import { hashToken, timingSafeEqual } from "@/lib/auth";

const COOKIE_NAME = "tf_auth";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/github/webhook"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = process.env.APP_ACCESS_TOKEN;
  // Fail-closed: ohne konfiguriertes Token ist die App komplett gesperrt statt offen.
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "APP_ACCESS_TOKEN not configured" }, { status: 503 });
    }
    return new NextResponse("Auth nicht konfiguriert (APP_ACCESS_TOKEN fehlt)", { status: 503 });
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie) {
    const expectedHash = await hashToken(token);
    if (timingSafeEqual(cookie, expectedHash)) return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
