"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "@/lib/api";

/**
 * 管理者用ログインページ（/login）。
 * 成功するとトップへ遷移する。Cookie を確実に反映させるためフルロードで遷移する。
 */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">ONORE ANALYTICS</h1>
        <p className="login-sub">管理者ログイン</p>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <label className="login-field">
          <span>ユーザー名</span>
          <input
            type="text"
            className="text-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="login-field">
          <span>パスワード</span>
          <input
            type="password"
            className="text-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary login-submit"
          disabled={submitting}
        >
          {submitting ? "ログイン中…" : "ログイン"}
        </button>

        <a href="/" className="login-back">
          トップへ戻る
        </a>
      </form>
    </main>
  );
}
