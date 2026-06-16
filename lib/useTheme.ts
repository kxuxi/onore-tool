"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadThemePref,
  saveThemePref,
  resolveTheme,
  applyTheme,
  COLOR_SCHEME_QUERY,
  type ThemePref,
  type ResolvedTheme,
} from "./theme";

/** テーマの好み・解決結果・切替操作をまとめたフックの戻り値。 */
export interface ThemeController {
  themePref: ThemePref;
  resolvedTheme: ResolvedTheme | null;
  setTheme: (pref: ThemePref) => void;
  toggleTheme: () => void;
}

/**
 * テーマ（ライト/ダーク）の状態管理。好みの読込・保存、`<html>` への適用、
 * 「自動」での時間帯追従、「OSに合わせる」での即時追従までを担う。
 */
export function useTheme(): ThemeController {
  const [themePref, setThemePref] = useState<ThemePref>("auto");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme | null>(null);

  // 好みからテーマを解決して <html> へ適用し、見た目の状態も控えておく。
  const applyThemeResolved = useCallback((pref: ThemePref) => {
    const r = resolveTheme(pref);
    applyTheme(r);
    setResolvedTheme(r);
  }, []);

  // テーマの好みをローカルから読み込み、解決して適用する。
  useEffect(() => {
    const pref = loadThemePref();
    setThemePref(pref);
    applyThemeResolved(pref);
  }, [applyThemeResolved]);

  // 「自動」のときは時間帯の境界（昼/夜）をまたいでも追従するよう定期的に再適用する。
  useEffect(() => {
    if (themePref !== "auto") return;
    const id = window.setInterval(() => {
      applyThemeResolved("auto");
    }, 60_000);
    return () => window.clearInterval(id);
  }, [themePref, applyThemeResolved]);

  // 「OSに合わせる」のときは、OSの外観設定の変更に即時追従する。
  useEffect(() => {
    if (themePref !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(COLOR_SCHEME_QUERY);
    const onChange = () => applyThemeResolved("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePref, applyThemeResolved]);

  // テーマの好みを変更して保存・即時適用する。
  const setTheme = useCallback(
    (pref: ThemePref) => {
      setThemePref(pref);
      saveThemePref(pref);
      applyThemeResolved(pref);
    },
    [applyThemeResolved]
  );

  // ヘッダーのワンタップ切替。現在の見た目と逆のテーマを明示指定する
  //（auto/system からでもライト⇔ダークへ即切替できる）。
  const toggleTheme = useCallback(() => {
    const current = resolvedTheme ?? resolveTheme(themePref);
    setTheme(current === "dark" ? "light" : "dark");
  }, [resolvedTheme, themePref, setTheme]);

  return { themePref, resolvedTheme, setTheme, toggleTheme };
}
