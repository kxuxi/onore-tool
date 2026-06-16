"use client";

import { useEffect, useState } from "react";
import type { ToastMsg } from "@/lib/useToasts";

/** トースト自動消去のミリ秒（成功のみ。エラーは手動で閉じるまで残す）。 */
const TOAST_AUTO_DISMISS_MS = 2400;

/** 1件のトースト。成功は一定時間で自動消去するが、ホバー/フォーカス中は消さない。 */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMsg;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    // エラーは重要なので自動消去しない。ホバー/フォーカス中も消さない。
    if (toast.kind === "error" || paused) return;
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      TOAST_AUTO_DISMISS_MS
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.kind, paused, onDismiss]);
  return (
    <div
      className={"toast " + toast.kind}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="通知を閉じる"
      >
        ×
      </button>
    </div>
  );
}

/** 画面右下のトーストスタック。空のときは何も描画しない。 */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
