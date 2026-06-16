import { NextResponse } from "next/server";

/**
 * API ルート共通のエラー応答を生成するファクトリ。
 *
 * 詳細は常にサーバーログにのみ出力する。本番では内部情報（DB接続文字列・スキーマ等）の
 * 漏えいを防ぐため汎用文言のみを返し、開発時のみ詳細メッセージを返す。
 *
 * @param scope ログ接頭辞に使うルート識別子（例: "api/state"）
 */
export function makeErrorResponse(scope: string) {
  return function errorResponse(context: string, err: unknown) {
    console.error(`[${scope}] ${context} failed:`, err);
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message, context }, { status: 500 });
    }
    return NextResponse.json(
      { error: "サーバー内部エラーが発生しました。" },
      { status: 500 }
    );
  };
}
