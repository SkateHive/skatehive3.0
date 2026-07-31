import { NextRequest, NextResponse } from "next/server";
import { COFRINHOS_COOKIE, getAuthedAccount } from "@/lib/cofrinhos/auth";

/**
 * GET  /api/cofrinhos/auth/session  -> { account } | 401
 * DELETE /api/cofrinhos/auth/session -> clears the cofrinhos cookie
 */
export async function GET(request: NextRequest) {
  const account = getAuthedAccount(request);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ account });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COFRINHOS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
