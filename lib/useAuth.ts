"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "./types";
import { fetchMe, login as apiLogin, logout as apiLogout } from "./api";

export interface UseAuth {
  /** ログイン中のユーザー（未ログインなら null）。 */
  user: AuthUser | null;
  /** 認証状態の初回確認が完了したか（false の間は判定を保留しちらつきを防ぐ）。 */
  ready: boolean;
  /** 管理者（ログイン済み）かどうか。 */
  isAdmin: boolean;
  /** ログインしてユーザー情報を更新する。 */
  login: (username: string, password: string) => Promise<AuthUser>;
  /** ログアウトして状態を初期化する。 */
  logout: () => Promise<void>;
}

/**
 * ログイン状態を管理するフック。マウント時に /api/auth/me で現在の状態を確認し、
 * login / logout を提供する。サーバーの HttpOnly Cookie が真実の源で、ここは UI 用。
 */
export function useAuth(): UseAuth {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await apiLogin(username, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return { user, ready, isAdmin: !!user, login, logout };
}
