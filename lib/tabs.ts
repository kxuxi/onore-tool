import type { TabKey } from "./types";

/**
 * サイドバーのタブ構成（純粋なデータのみ。アイコン等の JSX は持たない）。
 * アイコンは描画側（app/page.tsx）でキーから引く。ここはテスト可能な純粋ロジックに保つ。
 */

/** サイドバーのグループキー（似た画面をまとめた単位）。 */
export type TabGroupKey =
  | "history"
  | "warlords"
  | "ranking"
  | "encyclopedia"
  | "nations"
  | "settings";

/** タブ（リーフ）ごとの短いラベル。ページ内サブタブの見出し・タイトルに使う。 */
export const TAB_LABELS: Record<TabKey, string> = {
  history: "戦闘履歴",
  scout: "偵察検索",
  damage: "被弾表",
  swi: "ランキング",
  db: "DB確認",
  units: "兵種",
  weapons: "武器",
  items: "品物",
  nations: "国",
  factions: "環境設定",
};

/** サイドバーのグループ定義（ラベルと、束ねるリーフタブの一覧）。 */
export interface TabGroup {
  key: TabGroupKey;
  label: string;
  tabs: TabKey[];
}

/**
 * サイドバーのグループ定義。似た画面を1グループにまとめ、複数リーフを持つ
 * グループはページ内のサブタブ（セグメント）で切り替える。
 */
export const TAB_GROUPS: TabGroup[] = [
  { key: "history", label: "戦闘履歴", tabs: ["history"] },
  { key: "warlords", label: "武将", tabs: ["scout", "damage", "db"] },
  { key: "ranking", label: "ランキング", tabs: ["swi"] },
  { key: "encyclopedia", label: "図鑑", tabs: ["units", "weapons", "items"] },
  { key: "nations", label: "国", tabs: ["nations"] },
  { key: "settings", label: "環境設定", tabs: ["factions"] },
];

/** リーフタブ → 所属グループ の逆引き。 */
export const GROUP_OF_TAB: Record<TabKey, TabGroupKey> = TAB_GROUPS.reduce(
  (acc, g) => {
    for (const t of g.tabs) acc[t] = g.key;
    return acc;
  },
  {} as Record<TabKey, TabGroupKey>
);

/** すべての有効なリーフタブキー（URL のタブ検証に使う）。 */
export const ALL_TAB_KEYS: TabKey[] = TAB_GROUPS.flatMap((g) => g.tabs);
