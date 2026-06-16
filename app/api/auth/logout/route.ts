import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ログアウト。セッション Cookie を即時失効させる。 */
export async function POST() {
  cookies().set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return NextResponse.json({ ok: true });
}
