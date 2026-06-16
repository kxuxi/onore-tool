import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 現在のログイン状態を返す（未ログインなら user: null）。 */
export async function GET() {
  const session = getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: { id: session.uid, username: session.username },
  });
}
