"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

/** デスクトップとみなすビューポート幅の下限。globals.css のサイドバー表示と揃える。 */
const SIDEBAR_DESKTOP_QUERY = "(min-width: 768px)";

/** デスクトップでのサイドバー開閉の好みを保存する localStorage キー。 */
const SIDEBAR_KEY = "onore.sidebarOpen";

export interface SidebarLayoutState {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
}

/**
 * サイドバーの開閉状態とモバイル判定を管理するフック。
 *
 * - デスクトップ（768px 以上）: 前回の開閉状態を localStorage から復元。既定は開く。
 * - モバイル（768px 未満）: オーバーレイのため常に閉じた状態で始める。
 * - デスクトップの開閉操作は localStorage へ保存し次回以降復元する。
 * - モバイルでサイドバーが開いている間は body のスクロールをロックする。
 */
export function useSidebarLayout(): SidebarLayoutState {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 画面幅に応じてサイドバーの初期表示を切り替え
  useEffect(() => {
    const mql = window.matchMedia(SIDEBAR_DESKTOP_QUERY);

    const readDesktopPref = () => {
      try {
        const v = window.localStorage.getItem(SIDEBAR_KEY);
        return v === null ? true : v === "1";
      } catch {
        return true;
      }
    };

    const apply = (isDesktop: boolean) => {
      setIsMobile(!isDesktop);
      // デスクトップは保存した好みを復元。モバイルはオーバーレイのため常に閉じる。
      setSidebarOpen(isDesktop ? readDesktopPref() : false);
    };

    apply(mql.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // モバイルでサイドバー展開中は背景（body）のスクロールをロックする。
  useEffect(() => {
    if (!(isMobile && sidebarOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      if (!isMobile) {
        try {
          window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
        } catch {
          /* localStorage 不可（プライベートモード等）でも開閉自体は動作させる */
        }
      }
      return next;
    });
  }, [isMobile]);

  return { sidebarOpen, setSidebarOpen, isMobile, toggleSidebar };
}
