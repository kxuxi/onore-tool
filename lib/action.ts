import type { Warlord } from "./types";

export type ActionStatus = "done" | "ready" | "unknown" | "none";

export interface ActionInfo {
  status: ActionStatus;
  /** 行動時刻からの経過分（行動時刻が無い場合は null） */
  minutes: number | null;
  /** 直近2回の行動がちょうど1時間間隔（=休養なしで連続行動）か */
  noRest: boolean;
}

export const ACTION_LABEL: Record<ActionStatus, string> = {
  done: "行動済み",
  ready: "行動可",
  unknown: "不明",
  none: "データなし",
};

/** ステータスの並び順の重み（小さいほど上）。行動可→不明→行動済み。 */
export const STATUS_ORDER: Record<ActionStatus, number> = {
  ready: 0,
  unknown: 1,
  done: 2,
  none: 3,
};

/**
 * "MM/DD HH:mm" 形式の行動時刻を Date に変換する。
 * 年は履歴に含まれないため、基準時刻(now)の年を採用する。
 * ただし算出結果が now より大きく未来になる場合は前年とみなす（年またぎ対策）。
 */
export function parseActionDate(
  lastActionAt: string | undefined,
  now: Date
): Date | null {
  if (!lastActionAt) return null;
  const m = lastActionAt.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, mm, dd, hh, min] = m;
  let year = now.getFullYear();
  let d = new Date(
    year,
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    0,
    0
  );
  // 未来（now より先）になったら前年の同日時とみなす
  if (d.getTime() - now.getTime() > 60 * 1000) {
    year -= 1;
    d = new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
  }
  return d;
}

/**
 * 行動時刻からの経過時間でステータスを判定する。
 *  - 40分以内            … 行動済み (done)
 *  - 40分〜1時間20分     … 行動可  (ready)
 *  - 1時間20分以上       … 不明    (unknown)
 *  - 行動時刻なし        … データなし (none)
 */
export function getActionInfo(w: Warlord, now: Date): ActionInfo {
  const d = parseActionDate(w.lastActionAt, now);
  if (!d) return { status: "none", minutes: null, noRest: false };
  const minutes = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  let status: ActionStatus;
  if (minutes < 40) status = "done";
  else if (minutes < 80) status = "ready";
  else status = "unknown";
  return { status, minutes, noRest: isNoRest(w, now) };
}

/**
 * 直近2回の行動がちょうど1時間（60分）間隔なら「休養なし」と判定する。
 * （前々回と前回の行動が同じ分で1時間きっかり空いている = 連続行動）
 */
function isNoRest(w: Warlord, now: Date): boolean {
  const acts = w.actions;
  if (!acts || acts.length < 2) return false;
  const last = parseActionDate(acts[acts.length - 1], now);
  const prev = parseActionDate(acts[acts.length - 2], now);
  if (!last || !prev) return false;
  const diff = Math.round((last.getTime() - prev.getTime()) / 60000);
  return diff === 60;
}

/** 経過分を "1時間05分" のような表記にする */
export function formatElapsed(minutes: number | null): string {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}分`;
  return `${h}時間${String(m).padStart(2, "0")}分`;
}
