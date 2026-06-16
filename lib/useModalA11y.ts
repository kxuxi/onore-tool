import { useEffect, useRef } from "react";

/** モーダル内でフォーカス可能な要素のセレクタ。 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * モーダル（dialog / alertdialog）に基本的なアクセシビリティを付与するフック。
 *
 * - 開いたときにモーダル内へフォーカスを移動する
 * - Escape キーで onClose を呼ぶ
 * - Tab / Shift+Tab のフォーカスをモーダル内にトラップする
 * - 閉じたときに元のフォーカス位置へ復帰する
 * - 開いている間は背景（body）のスクロールをロックする
 *
 * 返り値の ref をモーダルのコンテナ要素に付与して使う。
 * モーダルが入れ子になる場合は、最前面のモーダルだけ isOpen を true にすること
 * （背面のモーダルは isOpen を false にしてトラップを無効化する）。
 */
export function useModalA11y<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void
) {
  const ref = useRef<T>(null);
  // 依存配列で effect を再実行させずに最新の onClose を参照する。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableItems = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // 先頭の操作要素（無ければコンテナ自身）へフォーカスを移す。
    const items = focusableItems();
    if (items.length > 0) {
      items[0].focus();
    } else {
      node.setAttribute("tabindex", "-1");
      node.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const current = focusableItems();
      if (current.length === 0) {
        e.preventDefault();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // 背景スクロールのロック。
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      // 元のフォーカス位置がまだ存在すれば、そこへ戻す。
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return ref;
}
