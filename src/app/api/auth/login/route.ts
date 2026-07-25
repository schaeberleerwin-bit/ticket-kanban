import { NextRequest, NextResponse } from "next/server";
import { hashToken, timingSafeEqual } from "@/lib/auth";

const COOKIE_NAME = "tf_auth";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const expected = process.env.APP_ACCESS_TOKEN;

  if (!expected || typeof token !== "string") {
    return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
  }

  const [tokenHash, expectedHash] = await Promise.all([hashToken(token), hashToken(expected)]);
  if (!timingSafeEqual(tokenHash, expectedHash)) {
    return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
  }

  // Cookie enthält einen Hash des Tokens, nicht das Token selbst — ein geleakter Cookie
  // (XSS, Logs, Proxy) legt damit nicht das eigentliche Master-Secret offen.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, expectedHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
