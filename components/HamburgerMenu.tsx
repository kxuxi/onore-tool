"use client";

import { useEffect, useState } from "react";

interface Props {
  onResetDb: () => void;
}

export function HamburgerMenu({ onResetDb }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Esc で閉じる
  useEffect(() => {
    if (!open && !confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirming) setConfirming(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirming]);

  // 開いている間は背景スクロール抑止
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleReset = () => {
    onResetDb();
    setConfirming(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="hamburger"
        aria-label="メニューを開く"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="drawer" role="dialog" aria-label="メニュー">
            <div className="drawer-header">
              <h2>MENU</h2>
              <button
                type="button"
                className="icon-btn"
                aria-label="閉じる"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => setConfirming(true)}
            >
              DBをリセット
            </button>

            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              ブラウザの localStorage に保存された武将データを全削除します。
            </p>
          </aside>
        </>
      )}

      {confirming && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirming(false)}
          role="presentation"
        >
          <div
            className="modal"
            role="alertdialog"
            aria-labelledby="reset-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-title">DBをリセットしますか？</h3>
            <p>
              登録済みの武将データを全て削除します。この操作は元に戻せません。
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleReset}
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
