import type { UnitType } from "./types";

/** 兵種フォームの初期値（新規追加用） */
export const EMPTY_UNIT: UnitType = {
  name: "",
  category: "",
  goodAgainst: "",
  attack: 0,
  defense: 0,
  cost: "",
  tech: "",
  years: "",
  reqStats: "",
  facility: "",
  special: "",
  bonus: "",
};

/** 必要能力値セレクタの基本候補 */
export const BASE_STAT_OPTIONS = ["統率", "武力", "知力", "政治"];

/** 雇用コストの通貨候補（金 / 米） */
export const COST_CURRENCIES = ["金", "米"];

/** "弓兵:壁:" のような区切り文字列を ["弓兵", "壁"] に分解 */
export function splitGoodAgainst(value: string): string[] {
  return value
    .split(/[:：]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "武力:40" を { stat: "武力", num: "40" } に分解 */
export function parseReqStats(value: string): { stat: string; num: string } {
  const m = value.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
  if (m) return { stat: m[1].trim(), num: m[2].trim() };
  return { stat: value.trim(), num: "" };
}

/** ステータス名と数値を "武力:40" 形式に再構成 */
export function composeReqStats(stat: string, num: string): string {
  const s = stat.trim();
  if (!s) return "";
  return `${s}:${num.trim()}`;
}

/** "金:600" を { currency: "金", amount: "600" } に分解（区切りが無ければ金額のみ扱い） */
export function parseCost(value: string): { currency: string; amount: string } {
  const m = value.match(/^\s*([^:：\d-]+)[:：]\s*(.*)$/);
  if (m) return { currency: m[1].trim(), amount: m[2].trim() };
  return { currency: COST_CURRENCIES[0], amount: value.trim() };
}

/** 通貨と金額を "金:600" 形式に再構成（金額が空なら空文字） */
export function composeCost(currency: string, amount: string): string {
  const a = amount.trim();
  if (!a) return "";
  const c = (currency || COST_CURRENCIES[0]).trim();
  return `${c}:${a}`;
}

/** "36年" から数値部分 "36" を取り出す */
export function parseYears(value: string): string {
  const m = value.match(/(\d+)/);
  return m ? m[1] : "";
}

/** 数値を "36年" 形式に再構成（空なら空文字） */
export function composeYears(num: string): string {
  const n = num.trim();
  if (!n) return "";
  return `${n}年`;
}
