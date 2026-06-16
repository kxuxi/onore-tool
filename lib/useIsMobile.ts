"use client";

import { useEffect, useState } from "react";

/** モバイル（カード/縦長レイアウト）と判定するビューポート幅の上限。globals.css と揃える。 */
export const MOBILE_QUERY = "(max-width: 680px)";

/**
 * 現在のビューポートがモバイル幅かどうかを返すフック。
 * SSR/初回レンダリングでは常に false を返し、マウント後に実値へ更新するため、
 * これを初期表示の分岐に使う場合は「マウント後に評価される」ことに留意する。
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return isMobile;
}
