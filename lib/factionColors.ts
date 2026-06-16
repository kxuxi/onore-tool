/** 国（勢力）ごとの表示色設定。ブラウザの localStorage に保存する。 */
import type { CSSProperties } from "react";

export type FactionColorMap = Record<string, string>;

const KEY = "onore-tool:faction-colors:v1";

/** 左チーム（攻撃側）勝利時の既定色 */
export const DEFAULT_WIN_LEFT = "#1D9E75";
/** 右チーム（防衛側）勝利時の既定色 */
export const DEFAULT_WIN_RIGHT = "#D85A30";

/** 国に割り当てられる色見本（名前付き固定パレット） */
export interface PaletteColor {
  name: string;
  value: string;
}

export const FACTION_PALETTE: PaletteColor[] = [
  { name: "白", value: "#FFFFFF" },
  { name: "赤", value: "#CC3333" },
  { name: "濃赤", value: "#881111" },
  { name: "朱", value: "#DD5500" },
  { name: "橙", value: "#EE8811" },
  { name: "山吹", value: "#DDAA00" },
  { name: "黄", value: "#DDCC00" },
  { name: "黄緑", value: "#88BB00" },
  { name: "緑", value: "#338833" },
  { name: "濃緑", value: "#116611" },
  { name: "深緑", value: "#004422" },
  { name: "黒", value: "#111111" },
  { name: "水色", value: "#44AACC" },
  { name: "浅葱", value: "#008899" },
  { name: "青緑", value: "#007766" },
  { name: "水浅葱", value: "#66BBCC" },
  { name: "青", value: "#3366BB" },
  { name: "濃青", value: "#113388" },
  { name: "藍", value: "#223399" },
  { name: "紫", value: "#7733AA" },
  { name: "濃紫", value: "#551188" },
  { name: "赤紫", value: "#AA3377" },
  { name: "桃", value: "#EE88AA" },
  { name: "薄桃", value: "#FFBBCC" },
  { name: "灰", value: "#888888" },
  { name: "薄灰", value: "#AAAAAA" },
  { name: "茶", value: "#886633" },
  { name: "濃茶", value: "#664422" },
  { name: "肌", value: "#DDBB99" },
  { name: "薄黄", value: "#EEDD88" },
];

/** 色値（#RRGGBB）からパレット名を引く。無ければ undefined。 */
export function paletteName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toUpperCase();
  return FACTION_PALETTE.find((c) => c.value.toUpperCase() === v)?.name;
}


export function loadFactionColors(): FactionColorMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as FactionColorMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveFactionColors(map: FactionColorMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

/**
 * 勢力（国）の表示色を返す。色が未設定なら、左右どちらの側かに応じた
 * 既定色（左=緑 / 右=橙）へフォールバックする。
 * 戦闘カードで左右それぞれの側の色を塗るために使う。
 */
export function resolveFactionColor(
  faction: string | undefined,
  fallback: string,
  colors: FactionColorMap
): string {
  return (faction && colors[faction]) || fallback;
}

/** `#RGB` / `#RRGGBB` を 0-255 の RGB に分解する（不正な値は null）。 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** sRGB チャンネルをリニア輝度へ変換（WCAG 相対輝度用）。 */
function srgbChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** RGB の相対輝度（0～1）。 */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

/**
 * 暗い国色を黒背景の画面でも読めるよう白へ寄せて明度を確保する。
 * 明るい色はそのまま返す。返り値は `rgb(r, g, b)` 文字列。
 */
export function readableOnDark(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let { r, g, b } = rgb;
  const target = 0.38;
  for (let i = 0; i < 8 && luminance(r, g, b) < target; i++) {
    r = Math.round(r + (255 - r) * 0.22);
    g = Math.round(g + (255 - g) * 0.22);
    b = Math.round(b + (255 - b) * 0.22);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 国名をテキストとして表示する箇所用の色スタイル。
 * その国に色が設定されているときだけ読みやすい色を返し、未設定なら undefined（既定色のまま）。
 */
export function factionNameStyle(
  faction: string | undefined,
  colors: FactionColorMap
): CSSProperties | undefined {
  const hex = faction ? colors[faction] : undefined;
  if (!hex) return undefined;
  return { color: readableOnDark(hex) };
}

/**
 * 国名をバッジ（`.tag.faction` などのピル）で表示する箇所用の色スタイル。
 * 文字は読みやすい国色、枠線・背景はその国色の半透明でチントする。
 * 未設定なら undefined（既定のピンクピルのまま）。
 */
export function factionBadgeStyle(
  faction: string | undefined,
  colors: FactionColorMap
): CSSProperties | undefined {
  const hex = faction ? colors[faction] : undefined;
  if (!hex) return undefined;
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  const { r, g, b } = rgb;
  return {
    color: readableOnDark(hex),
    borderColor: `rgba(${r}, ${g}, ${b}, 0.55)`,
    background: `rgba(${r}, ${g}, ${b}, 0.16)`,
  };
}
