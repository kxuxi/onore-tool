import {
  parseBattleCard,
  normalizeDisplayToken,
  battleKey,
  type BattleCard,
  type BattleSide,
  type BattleWinner,
} from "./parser";
import { parseActionDate } from "./action";
import type { BattleRecord } from "./types";

export type SideKey = "left" | "right";
export type OutcomeResult = "win" | "loss" | "other";

/** 1 戦闘を「ある側（武将 / 兵種）の視点」で見た結果 */
export interface BattleOutcome {
  record: BattleRecord;
  card: BattleCard;
  /** 注目している側 */
  side: SideKey;
  /** 注目側の情報 */
  self: BattleSide;
  /** 相手側の情報 */
  opponent: BattleSide;
  /** 注目側から見た勝敗 */
  result: OutcomeResult;
}

export interface StatSummary {
  /** 関与した戦闘総数 */
  battles: number;
  wins: number;
  losses: number;
  /** 撤退・引分・不明など勝敗が確定しなかった数 */
  others: number;
  /** 勝敗が確定した数 (wins + losses) */
  decided: number;
  /** 勝率 0..1（decided が 0 のときは 0） */
  winRate: number;
}

/** 指定した側から見た勝敗。draw / retreat / unknown は "other"。 */
export function outcomeForSide(
  winner: BattleWinner,
  side: SideKey
): OutcomeResult {
  if (winner === "left" || winner === "right") {
    return winner === side ? "win" : "loss";
  }
  return "other";
}

/** ログをカード化し、内容が重複する行を除外する。 */
function dedupedCards(
  log: BattleRecord[]
): { record: BattleRecord; card: BattleCard }[] {
  const seen = new Set<string>();
  const out: { record: BattleRecord; card: BattleCard }[] = [];
  for (const record of log) {
    const key = battleKey(record.line);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const card = parseBattleCard(record.line);
    if (card) out.push({ record, card });
  }
  return out;
}

function makeOutcome(
  record: BattleRecord,
  card: BattleCard,
  side: SideKey
): BattleOutcome {
  const self = side === "left" ? card.left : card.right;
  const opponent = side === "left" ? card.right : card.left;
  return {
    record,
    card,
    side,
    self,
    opponent,
    result: outcomeForSide(card.winner, side),
  };
}

/** 戦闘時刻の新しい順に並べ替える。 */
function sortByTimeDesc(list: BattleOutcome[]): BattleOutcome[] {
  const now = new Date();
  const timeOf = (o: BattleOutcome) =>
    parseActionDate(o.record.time, now)?.getTime() ?? null;
  return [...list].sort((a, b) => {
    const ta = timeOf(a);
    const tb = timeOf(b);
    if (ta != null && tb != null) {
      if (tb !== ta) return tb - ta;
      return b.record.savedAt - a.record.savedAt;
    }
    if (ta != null) return -1;
    if (tb != null) return 1;
    return b.record.savedAt - a.record.savedAt;
  });
}

function unitMatches(side: BattleSide, target: string): boolean {
  if (!side.unit) return false;
  return normalizeDisplayToken(side.unit) === target;
}

/** 指定武将が登場した戦闘を新しい順で集める。 */
export function collectWarlordBattles(
  log: BattleRecord[],
  name: string
): BattleOutcome[] {
  const target = name.trim();
  const out: BattleOutcome[] = [];
  for (const { record, card } of dedupedCards(log)) {
    // 通常は左右どちらか一方のみ一致する。両方一致した場合は左を優先。
    if (card.left.name === target) out.push(makeOutcome(record, card, "left"));
    else if (card.right.name === target)
      out.push(makeOutcome(record, card, "right"));
  }
  return sortByTimeDesc(out);
}

/** 指定兵種が使われた戦闘を集める（同戦闘で両側が使えば 2 件）。 */
export function collectUnitBattles(
  log: BattleRecord[],
  unitName: string
): BattleOutcome[] {
  const target = unitName.trim();
  const out: BattleOutcome[] = [];
  for (const { record, card } of dedupedCards(log)) {
    if (unitMatches(card.left, target))
      out.push(makeOutcome(record, card, "left"));
    if (unitMatches(card.right, target))
      out.push(makeOutcome(record, card, "right"));
  }
  return sortByTimeDesc(out);
}

/** 勝利数・敗北数・勝率などを集計する。 */
export function summarize(outcomes: BattleOutcome[]): StatSummary {
  let wins = 0;
  let losses = 0;
  let others = 0;
  for (const o of outcomes) {
    if (o.result === "win") wins++;
    else if (o.result === "loss") losses++;
    else others++;
  }
  const decided = wins + losses;
  return {
    battles: outcomes.length,
    wins,
    losses,
    others,
    decided,
    winRate: decided > 0 ? wins / decided : 0,
  };
}

/** 注目側が使った兵種の使用回数（多い順）。 */
export function unitUsage(
  outcomes: BattleOutcome[]
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const o of outcomes) {
    const u = o.self.unit ? normalizeDisplayToken(o.self.unit) : "不明";
    map.set(u, (map.get(u) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** outcomes の最新エントリから注目側のプロフィール（国・タイプ等）を得る。 */
export function latestSelfProfile(
  outcomes: BattleOutcome[]
): BattleSide | undefined {
  return outcomes[0]?.self;
}
