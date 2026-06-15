/** 国（勢力）ごとの表示色設定。ブラウザの localStorage に保存する。 */
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
 * 勝者側と勢力色から、カードのボーダー / 勝者名に使う色を決める。
 * 勢力に色が設定されていなければ、左右の既定色にフォールバックする。
 */
export function resolveWinColor(
  winner: "left" | "right" | "draw" | "retreat" | "unknown",
  leftFaction: string | undefined,
  rightFaction: string | undefined,
  colors: FactionColorMap
): string | undefined {
  if (winner === "left") {
    return (leftFaction && colors[leftFaction]) || DEFAULT_WIN_LEFT;
  }
  if (winner === "right") {
    return (rightFaction && colors[rightFaction]) || DEFAULT_WIN_RIGHT;
  }
  return undefined;
}
