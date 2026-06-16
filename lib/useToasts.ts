"use client";

import { useCallback, useRef, useState } from "react";

/** 画面右下に積み重ねて表示する通知トースト。 */
export type ToastMsg = {
  id: number;
  kind: "success" | "error";
  message: string;
};

/** トーストの状態と操作（追加 / 個別消去）をまとめたフックの戻り値。 */
export interface ToastController {
  toasts: ToastMsg[];
  pushToast: (kind: "success" | "error", message: string) => void;
  dismissToast: (id: number) => void;
}

/** 同時に保持するトーストの最大数（古いものから捨てる）。 */
const MAX_TOASTS = 4;

/** 通知トーストの状態を管理する。最大 {@link MAX_TOASTS} 件まで積み増す。 */
export function useToasts(): ToastController {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const seq = useRef(0);

  const pushToast = useCallback(
    (kind: "success" | "error", message: string) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev, { id, kind, message }].slice(-MAX_TOASTS));
    },
    []
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
