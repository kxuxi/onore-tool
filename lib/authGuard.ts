/**
 * Route Handler 用の認証ガード（next/headers の Cookie を読む）。
 * 純粋ロジックの lib/auth.ts とは分離し、こちらはフレームワーク API に依存する。
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "./auth";

/** 現在のリクエストのセッションユーザーを返す（未認証・失効なら null）。 */
export function getSessionUser(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * 管理者（ログイン済み）であることを要求するガード。
 * 未認証なら 401 レスポンスを、認証済みなら null を返す。
 * 呼び出し側は `const denied = requireAdmin(); if (denied) return denied;` と使う。
 */
export function requireAdmin(): NextResponse | null {
  if (!getSessionUser()) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  return null;
}
