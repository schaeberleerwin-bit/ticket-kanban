import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tf_auth";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/github/webhook"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = process.env.APP_ACCESS_TOKEN;
  // Kein Token konfiguriert → Auth-Layer deaktiviert (z.B. lokale Entwicklung)
  if (!token) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
