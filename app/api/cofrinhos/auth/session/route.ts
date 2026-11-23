import { NextRequest, NextResponse } from "next/server";
import {
  COFRINHOS_COOKIE,
  COFRINHOS_EVM_COOKIE,
  getAuthedAccount,
  getAuthedEvmAddress,
} from "@/lib/cofrinhos/auth";

/**
 * GET /api/cofrinhos/auth/session
 *   -> { account: string | null, evm_address: string | null } | 401 when neither
 * DELETE /api/cofrinhos/auth/session[?kind=hive|evm|all]
 *   Clears the Hive cookie (default, what the current wallet UI calls on an
 *   account switch), the wallet cookie, or both.
 */
export async function GET(request: NextRequest) {
  const account = getAuthedAccount(request);
  const evmAddress = getAuthedEvmAddress(request);
  if (!account && !evmAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ account, evm_address: evmAddress });
}

export async function DELETE(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") ?? "hive";
  if (kind !== "hive" && kind !== "evm" && kind !== "all") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  const clear = (name: string) =>
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  if (kind === "hive" || kind === "all") clear(COFRINHOS_COOKIE);
  if (kind === "evm" || kind === "all") clear(COFRINHOS_EVM_COOKIE);
  return response;
}
