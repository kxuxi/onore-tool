/**
 * ライト / ダークテーマの設定と、時間帯による自動切替を管理するユーティリティ。
 *
 * - ユーザーの好み（自動 / ライト / ダーク）を localStorage に保存する。
 * - 「自動」のときは時間帯で解決する（昼=ライト / 夜=ダーク）。
 * - 解決後のテーマは <html data-theme="..."> として適用し、CSS 変数を切り替える。
 *
 * 初期描画時のちらつき（FOUC）を防ぐため、同じロジックを app/layout.tsx の
 * インラインスクリプトでも実行する。判定を変える場合は両方を揃えること。
 */

/** ユーザーが選べるテーマの好み。 */
export type ThemePref = "auto" | "light" | "dark" | "system";

/** 実際に画面へ適用する解決済みテーマ。 */
export type ResolvedTheme = "light" | "dark";

/** OS のカラースキーム（ダーク）を判定するメディアクエリ。 */
export const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** テーマの好みを保存する localStorage キー。 */
export const THEME_STORAGE_KEY = "onore-tool:theme:v1";

/** 自動モードでライトになる開始時刻（この時刻以上）。 */
export const THEME_DAY_START = 6;
/** 自動モードでライトになる終了時刻（この時刻未満）。 */
export const THEME_DAY_END = 18;

/** 値が有効な ThemePref かどうか。 */
function isThemePref(v: unknown): v is ThemePref {
  return v === "auto" || v === "light" || v === "dark" || v === "system";
}

/** OS がダークテーマを希望しているか（prefers-color-scheme）。判定不可なら false。 */
export function prefersDarkOS(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(COLOR_SCHEME_QUERY).matches
    );
  } catch {
    return false;
  }
}

/** 保存済みのテーマの好みを読み込む（無ければ "auto"）。 */
export function loadThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePref(v)) return v;
  } catch {
    /* localStorage 不可（プライベートモード等）でも既定で動作させる */
  }
  return "auto";
}

/** テーマの好みを保存する。 */
export function saveThemePref(pref: ThemePref): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* 保存できなくても画面の切替自体は動作させる */
  }
}

/**
 * 好みと現在時刻から、実際に適用するテーマを解決する。
 * 「自動」のときは THEME_DAY_START〜THEME_DAY_END をライト、それ以外をダークにする。
 * 「OSに合わせる」(system) のときは prefers-color-scheme に従う。
 */
export function resolveTheme(
  pref: ThemePref,
  now: Date = new Date()
): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "system") return prefersDarkOS() ? "dark" : "light";
  const h = now.getHours();
  return h >= THEME_DAY_START && h < THEME_DAY_END ? "light" : "dark";
}

/** 解決済みテーマを <html data-theme> に適用する。 */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}
