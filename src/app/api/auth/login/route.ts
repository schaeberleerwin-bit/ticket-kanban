import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tf_auth";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  const expected = process.env.APP_ACCESS_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
