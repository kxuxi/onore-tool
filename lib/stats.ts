import {
  parseBattleCard,
  normalizeDisplayToken,
  battleKey,
  type BattleCard,
  type BattleSide,
  type BattleWinner,
} from "./parser";
import { parseActionDate } from "./action";
import type { BattleRecord, WarlordMap } from "./types";

export type SideKey = "left" | "right";
export type OutcomeResult = "win" | "loss" | "other";

/** 戦闘ログ一覧の 1 ページあたり表示件数（戦闘履歴・武将/兵種詳細で共通）。 */
export const BATTLE_LOG_PAGE_SIZE = 20;

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

/**
 * 勝率 (0..1) を表示用の文字列に整形する。
 * 勝敗が確定していない (decided === 0) ときは "—" を返す。
 * アプリ全体で表示桁を統一するため、各コンポーネントはこのヘルパーを利用する。
 */
export function formatWinRate(rate: number, decided: number): string {
  if (decided <= 0) return "—";
  return `${Math.round(rate * 100)}%`;
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

/* ---------- 相性ランキング・因縁の相手 ---------- */

/** 対戦相手ごとの戦績。 */
export interface OpponentStat {
  name: string;
  /** 直近の対戦時点での相手の所属国 */
  faction?: string;
  battles: number;
  wins: number;
  losses: number;
  others: number;
  decided: number;
  winRate: number;
}

/**
 * 対戦相手ごとに戦績を集計する。
 * outcomes は新しい順に並んでいるため、各相手の faction は最初に出現した
 * （＝最新の）対戦時のものを採用する。
 */
export function opponentStats(outcomes: BattleOutcome[]): OpponentStat[] {
  const map = new Map<string, OpponentStat>();
  for (const o of outcomes) {
    const name = o.opponent.name?.trim();
    if (!name) continue;
    let s = map.get(name);
    if (!s) {
      s = {
        name,
        faction: o.opponent.faction,
        battles: 0,
        wins: 0,
        losses: 0,
        others: 0,
        decided: 0,
        winRate: 0,
      };
      map.set(name, s);
    }
    s.battles++;
    if (o.result === "win") s.wins++;
    else if (o.result === "loss") s.losses++;
    else s.others++;
  }
  const arr = Array.from(map.values());
  for (const s of arr) {
    s.decided = s.wins + s.losses;
    s.winRate = s.decided > 0 ? s.wins / s.decided : 0;
  }
  return arr;
}

/** 相性ランキング（勝敗が確定した相手のみ。良い順／悪い順）。 */
export interface MatchupRanking {
  best: OpponentStat[];
  worst: OpponentStat[];
}

/**
 * 対戦相手を勝率順に並べ、相性の良い／苦手な相手 TOP3 を返す。
 * 勝敗が確定した対戦が 1 度でもある相手のみ対象。
 * - 相性の良い相手 = 勝ち越している相手（勝率 > 50%）を勝率の高い順に。
 * - 苦手な相手 = 負け越している相手（勝率 < 50%）を勝率の低い順に。
 * 勝率 50%（五分）の相手はどちらにも含めない。良い／苦手は勝率で
 * 明確に分かれるため、同じ相手が両方に出ることはない。
 */
export function matchupRanking(
  outcomes: BattleOutcome[],
  top = 3
): MatchupRanking {
  const decided = opponentStats(outcomes).filter((s) => s.decided > 0);
  const best = decided
    .filter((s) => s.winRate > 0.5)
    .sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.decided - a.decided ||
        b.battles - a.battles
    )
    .slice(0, top);
  const worst = decided
    .filter((s) => s.winRate < 0.5)
    .sort(
      (a, b) =>
        a.winRate - b.winRate ||
        b.decided - a.decided ||
        b.battles - a.battles
    )
    .slice(0, top);
  return { best, worst };
}

/* ---------- 兵科別の勝率 ---------- */

/** 兵科（万能 / 騎兵 / 歩兵 など）ごとの戦績。 */
export interface BranchStat {
  branch: string;
  battles: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number;
}

/** 注目側が出陣した兵科ごとに勝率を集計する（戦闘数の多い順）。 */
export function branchStats(outcomes: BattleOutcome[]): BranchStat[] {
  const map = new Map<string, BranchStat>();
  for (const o of outcomes) {
    const branch = o.self.branch?.trim() || "不明";
    let s = map.get(branch);
    if (!s) {
      s = { branch, battles: 0, wins: 0, losses: 0, decided: 0, winRate: 0 };
      map.set(branch, s);
    }
    s.battles++;
    if (o.result === "win") s.wins++;
    else if (o.result === "loss") s.losses++;
  }
  const arr = Array.from(map.values());
  for (const s of arr) {
    s.decided = s.wins + s.losses;
    s.winRate = s.decided > 0 ? s.wins / s.decided : 0;
  }
  return arr.sort((a, b) => b.battles - a.battles);
}

/* ---------- 時間帯・曜日別の勝率ヒートマップ ---------- */

/** 曜日ラベル（getDay() の 0..6 に対応）。 */
export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
/** 1 バケットあたりの時間幅（時間）。 */
const HEAT_BUCKET_HOURS = 3;
/** 時間帯バケット数（24h / 3h = 8）。 */
export const HEAT_BUCKETS = 24 / HEAT_BUCKET_HOURS;

export interface HeatCell {
  battles: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number;
}

export interface WinHeatmap {
  /** [曜日 0..6][時間帯バケット 0..HEAT_BUCKETS-1] */
  cells: HeatCell[][];
  /** 各バケットの開始時刻ラベル（例: "0", "3", ...） */
  bucketLabels: string[];
  /** 日時を特定できた戦闘数 */
  dated: number;
}

/**
 * 戦闘を「曜日 × 時間帯」のセルに振り分け、各セルの勝率を求める。
 * 行動時刻（実時刻 MM/DD HH:mm）を基準にするため曜日は現実の曜日になる。
 */
export function winHeatmap(outcomes: BattleOutcome[]): WinHeatmap {
  const now = new Date();
  const cells: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: HEAT_BUCKETS }, () => ({
      battles: 0,
      wins: 0,
      losses: 0,
      decided: 0,
      winRate: 0,
    }))
  );
  let dated = 0;
  for (const o of outcomes) {
    const d = parseActionDate(o.record.time, now);
    if (!d) continue;
    dated++;
    const day = d.getDay();
    const bucket = Math.min(
      HEAT_BUCKETS - 1,
      Math.floor(d.getHours() / HEAT_BUCKET_HOURS)
    );
    const c = cells[day][bucket];
    c.battles++;
    if (o.result === "win") c.wins++;
    else if (o.result === "loss") c.losses++;
  }
  for (const row of cells) {
    for (const c of row) {
      c.decided = c.wins + c.losses;
      c.winRate = c.decided > 0 ? c.wins / c.decided : 0;
    }
  }
  const bucketLabels = Array.from(
    { length: HEAT_BUCKETS },
    (_, i) => `${i * HEAT_BUCKET_HOURS}`
  );
  return { cells, bucketLabels, dated };
}

/* ---------- 所属国の遍歴 ---------- */

/** ある国に所属していた 1 区間。 */
export interface FactionStint {
  faction: string;
  /** 区間内で最も古い在籍年（不明なら 0） */
  startYear: number;
  /** 区間内で最も新しい在籍年（不明なら 0） */
  endYear: number;
  battles: number;
  /** 以前にも所属していた国への出戻り区間か */
  returning: boolean;
}

/** battleAt（例: "1687年5月 06/15 09:30"）からゲーム内の年を取り出す。 */
function gameYear(card: BattleCard): number | null {
  const s = card.battleAt;
  if (!s) return null;
  const m = s.match(/(\d+)\s*年/);
  return m ? Number(m[1]) : null;
}

/** 戦闘（注目側視点の 1 件）からゲーム内の年を取り出す。年が不明なら null。 */
export function outcomeYear(o: BattleOutcome): number | null {
  return gameYear(o.card);
}

/**
 * battleAt からゲーム内の「年・月」を時系列順の比較値（year*12 + month）に変換する。
 * 月が取れない場合は year*12 を使う。年も取れなければ null。
 * 行動時刻（MM/DD HH:mm）は現実の時計時刻でありゲーム内の年とは無関係なため、
 * 所属国の遍歴はこのゲーム内年月を基準に並べる必要がある。
 */
function gameOrder(card: BattleCard): number | null {
  const year = gameYear(card);
  if (year == null) return null;
  const mm = card.battleAt?.match(/年\s*(\d+)\s*月/);
  const month = mm ? Number(mm[1]) : 1;
  return year * 12 + (month - 1);
}

/**
 * 武将が渡り歩いた国を時系列（古い順）の在籍区間に変換する。
 * 連続して同じ国に所属していた戦闘をまとめ、ゲーム内の年で区間を表す。
 * 一度離れた国へ戻った区間は returning（出戻り）として印を付ける。
 */
export function factionTimeline(outcomes: BattleOutcome[]): FactionStint[] {
  const now = new Date();
  const items = outcomes
    .map((o) => ({
      faction: o.self.faction?.trim() ?? "",
      year: gameYear(o.card),
      order: gameOrder(o.card),
      date: parseActionDate(o.record.time, now)?.getTime() ?? null,
      savedAt: o.record.savedAt,
    }))
    .filter((x) => x.faction.length > 0);
  // ゲーム内の年月（order）を最優先で古い順に並べる。
  // 同じ年月内のみ、補助的に実時刻・登録順で安定させる。
  items.sort((a, b) => {
    if (a.order != null && b.order != null) {
      if (a.order !== b.order) return a.order - b.order;
    } else if (a.order != null) {
      return -1;
    } else if (b.order != null) {
      return 1;
    }
    if (a.date != null && b.date != null && a.date !== b.date) {
      return a.date - b.date;
    }
    return a.savedAt - b.savedAt;
  });

  const stints: FactionStint[] = [];
  for (const it of items) {
    const prev = stints[stints.length - 1];
    if (prev && prev.faction === it.faction) {
      prev.battles++;
      if (it.year != null) {
        prev.startYear =
          prev.startYear === 0 ? it.year : Math.min(prev.startYear, it.year);
        prev.endYear = Math.max(prev.endYear, it.year);
      }
    } else {
      stints.push({
        faction: it.faction,
        startYear: it.year ?? 0,
        endYear: it.year ?? 0,
        battles: 1,
        returning: false,
      });
    }
  }
  // 同じ国が 2 度目以降に登場する区間は「出戻り」とみなす。
  const seen = new Set<string>();
  for (const s of stints) {
    if (seen.has(s.faction)) s.returning = true;
    seen.add(s.faction);
  }
  return stints;
}

/* ---------- 国（勢力）ページ ---------- */

/**
 * 指定した国が参戦した戦闘を、その国の視点で集める。
 * 1 戦闘で左右両軍が同じ国（同士討ち）の場合は 2 件になる。
 */
export function collectFactionBattles(
  log: BattleRecord[],
  faction: string
): BattleOutcome[] {
  const target = faction.trim();
  const out: BattleOutcome[] = [];
  for (const { record, card } of dedupedCards(log)) {
    if (card.left.faction?.trim() === target)
      out.push(makeOutcome(record, card, "left"));
    if (card.right.faction?.trim() === target)
      out.push(makeOutcome(record, card, "right"));
  }
  return sortByTimeDesc(out);
}

/** 国（勢力）一覧 1 行分の集計。 */
export interface FactionSummary {
  faction: string;
  /** 現在この国に所属している武将の人数（DB 名簿）。 */
  members: number;
  /** この国の旗で戦った戦闘数（同士討ちは左右で 2 件）。 */
  battles: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number;
}

/**
 * 全戦闘履歴と DB 名簿から、国（勢力）ごとの一覧を集計する。
 * 戦歴・名簿のいずれかに登場する国をすべて対象にし、戦闘数の多い順
 * （同数なら勝率の高い順 → 名前順）に並べて返す。
 */
export function factionSummaries(
  log: BattleRecord[],
  db: WarlordMap
): FactionSummary[] {
  const agg = new Map<
    string,
    { battles: number; wins: number; losses: number }
  >();
  const ensure = (faction: string) => {
    let a = agg.get(faction);
    if (!a) {
      a = { battles: 0, wins: 0, losses: 0 };
      agg.set(faction, a);
    }
    return a;
  };
  for (const { card } of dedupedCards(log)) {
    for (const side of ["left", "right"] as SideKey[]) {
      const s = side === "left" ? card.left : card.right;
      const faction = s.faction?.trim();
      if (!faction) continue;
      const a = ensure(faction);
      a.battles++;
      const r = outcomeForSide(card.winner, side);
      if (r === "win") a.wins++;
      else if (r === "loss") a.losses++;
    }
  }

  // 現在の所属人数（DB 名簿）。
  const members = new Map<string, number>();
  for (const w of Object.values(db)) {
    const faction = w.faction?.trim();
    if (!faction) continue;
    members.set(faction, (members.get(faction) ?? 0) + 1);
  }

  // 戦歴・名簿のどちらかに出てくる国をすべて対象にする。
  const names = new Set<string>([...agg.keys(), ...members.keys()]);
  const out: FactionSummary[] = [];
  for (const faction of names) {
    const a = agg.get(faction) ?? { battles: 0, wins: 0, losses: 0 };
    const decided = a.wins + a.losses;
    out.push({
      faction,
      members: members.get(faction) ?? 0,
      battles: a.battles,
      wins: a.wins,
      losses: a.losses,
      decided,
      winRate: decided > 0 ? a.wins / decided : 0,
    });
  }
  return out.sort(
    (a, b) =>
      b.battles - a.battles ||
      b.winRate - a.winRate ||
      a.faction.localeCompare(b.faction, "ja")
  );
}

/**
 * 現在その国に所属する武将 1 人分の「在籍区間」の戦績。
 * 渡り歩いてきた武将を考慮し、最後にその国へ加入してから今までの
 * 連続した在籍区間のみを対象にする（過去に一度離れて出戻った場合、
 * 古い在籍ぶんは含めない）。
 */
export interface FactionMemberStat {
  name: string;
  /** 現在の在籍区間での戦闘数 */
  battles: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number;
  /** 現在の在籍区間で最後に使った兵種（正規化済み）。不明なら undefined。 */
  latestUnit?: string;
  /** 最後に使った兵種の兵科。不明なら undefined。 */
  latestBranch?: string;
}

/**
 * 指定した国に「今も所属している武将」ごとに、現在の在籍区間の戦績を集計する。
 *
 * 渡り歩いてきた武将がいるため、各武将の全戦闘履歴をたどり、最後にその国で
 * 戦った時点から連続してその国に居た区間だけを採用する。これにより、別の国に
 * 居たときの戦績や、過去に一度離れる前の古い在籍ぶんは集計から除外される。
 * latestUnit / latestBranch には、その区間で最後に出陣したときの兵種を入れる。
 */
export function factionMemberStats(
  log: BattleRecord[],
  faction: string
): FactionMemberStat[] {
  const target = faction.trim();
  const cards = dedupedCards(log);

  // 1. この国で 1 度でも戦ったことのある武将名を集める。
  const participants = new Set<string>();
  for (const { card } of cards) {
    if (card.left.faction?.trim() === target && card.left.name?.trim())
      participants.add(card.left.name.trim());
    if (card.right.faction?.trim() === target && card.right.name?.trim())
      participants.add(card.right.name.trim());
  }
  if (participants.size === 0) return [];

  // 2. 参加武将の全戦闘履歴を集める（所属の変化を追うため他国での戦いも含む）。
  const history = new Map<string, BattleOutcome[]>();
  for (const { record, card } of cards) {
    for (const side of ["left", "right"] as SideKey[]) {
      const s = side === "left" ? card.left : card.right;
      const name = s.name?.trim();
      if (!name || !participants.has(name)) continue;
      const arr = history.get(name) ?? [];
      arr.push(makeOutcome(record, card, side));
      history.set(name, arr);
    }
  }

  // 3. 各武将について、最後にその国で戦った時点から連続する在籍区間を集計する。
  const out: FactionMemberStat[] = [];
  for (const [name, all] of history) {
    const sorted = sortByTimeDesc(all); // 新しい順
    const start = sorted.findIndex((o) => o.self.faction?.trim() === target);
    if (start === -1) continue;
    const stint: BattleOutcome[] = [];
    for (let i = start; i < sorted.length; i++) {
      if (sorted[i].self.faction?.trim() === target) stint.push(sorted[i]);
      else break; // 別の国に移る直前まで（＝現在の在籍区間）
    }
    let wins = 0;
    let losses = 0;
    for (const o of stint) {
      if (o.result === "win") wins++;
      else if (o.result === "loss") losses++;
    }
    const decided = wins + losses;
    const latest = stint[0];
    out.push({
      name,
      battles: stint.length,
      wins,
      losses,
      decided,
      winRate: decided > 0 ? wins / decided : 0,
      latestUnit: latest?.self.unit
        ? normalizeDisplayToken(latest.self.unit)
        : undefined,
      latestBranch: latest?.self.branch?.trim() || undefined,
    });
  }
  return out.sort(
    (a, b) =>
      b.battles - a.battles ||
      b.winRate - a.winRate ||
      a.name.localeCompare(b.name, "ja")
  );
}

/** 兵科ごとにまとめた「最新使用兵種」の内訳。 */
export interface BranchLatestUnits {
  /** 兵科名（不明・空欄は "その他"）。 */
  branch: string;
  /** この兵科を最新で使っている人数の合計。 */
  total: number;
  /** 兵種ごとの人数（多い順）。 */
  units: { unit: string; count: number }[];
}

/**
 * 武将ごとの「最新で使っている兵種」を兵科別に集計する。
 * 各エントリ（1 武将）の最新兵種を 1 票として数え、兵科 → 兵種の順にまとめる。
 * 兵科は人数の多い順（"その他" は末尾）、兵種は各兵科内で人数の多い順。
 */
export function latestUnitsByBranch(
  members: { latestBranch?: string; latestUnit?: string }[]
): BranchLatestUnits[] {
  const OTHER = "その他";
  const map = new Map<string, Map<string, number>>();
  for (const m of members) {
    const unit = m.latestUnit?.trim();
    if (!unit) continue;
    const branch = m.latestBranch?.trim() || OTHER;
    let units = map.get(branch);
    if (!units) {
      units = new Map<string, number>();
      map.set(branch, units);
    }
    units.set(unit, (units.get(unit) ?? 0) + 1);
  }
  const arr: BranchLatestUnits[] = Array.from(map.entries()).map(
    ([branch, units]) => {
      const list = Array.from(units.entries())
        .map(([unit, count]) => ({ unit, count }))
        .sort((a, b) => b.count - a.count || a.unit.localeCompare(b.unit, "ja"));
      const total = list.reduce((s, u) => s + u.count, 0);
      return { branch, total, units: list };
    }
  );
  return arr.sort((a, b) => {
    const ao = a.branch === OTHER ? 1 : 0;
    const bo = b.branch === OTHER ? 1 : 0;
    if (ao !== bo) return ao - bo; // "その他" は末尾
    return b.total - a.total || a.branch.localeCompare(b.branch, "ja");
  });
}

/* ---------- 兵種ページ：相性の良い／苦手な敵兵種 ---------- */

/** 注目兵種から見た、ある敵兵種に対する戦績。 */
export interface OpponentUnitStat {
  unit: string;
  battles: number;
  wins: number;
  losses: number;
  others: number;
  decided: number;
  winRate: number;
}

/** 相手の兵種ごとに、注目側視点の勝敗を集計する。 */
export function opponentUnitStats(
  outcomes: BattleOutcome[]
): OpponentUnitStat[] {
  const map = new Map<string, OpponentUnitStat>();
  for (const o of outcomes) {
    const unit = o.opponent.unit
      ? normalizeDisplayToken(o.opponent.unit)
      : "";
    if (!unit) continue;
    let s = map.get(unit);
    if (!s) {
      s = {
        unit,
        battles: 0,
        wins: 0,
        losses: 0,
        others: 0,
        decided: 0,
        winRate: 0,
      };
      map.set(unit, s);
    }
    s.battles++;
    if (o.result === "win") s.wins++;
    else if (o.result === "loss") s.losses++;
    else s.others++;
  }
  const arr = Array.from(map.values());
  for (const s of arr) {
    s.decided = s.wins + s.losses;
    s.winRate = s.decided > 0 ? s.wins / s.decided : 0;
  }
  return arr;
}

/** 相性の良い／苦手な敵兵種ランキング。 */
export interface UnitMatchupRanking {
  best: OpponentUnitStat[];
  worst: OpponentUnitStat[];
}

/**
 * 敵兵種を勝率順に並べ、相性の良い／苦手な兵種 TOP3 を返す。
 * 勝敗が確定した対戦が 1 度でもある兵種のみ対象。
 * - 相性の良い兵種 = 勝ち越している兵種（勝率 > 50%）を勝率の高い順に。
 * - 苦手な兵種 = 負け越している兵種（勝率 < 50%）を勝率の低い順に。
 * 勝率 50%（五分）の兵種はどちらにも含めない（同じ兵種が両方に出ない）。
 */
export function unitMatchupRanking(
  outcomes: BattleOutcome[],
  top = 3
): UnitMatchupRanking {
  const decided = opponentUnitStats(outcomes).filter((s) => s.decided > 0);
  const best = decided
    .filter((s) => s.winRate > 0.5)
    .sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.decided - a.decided ||
        b.battles - a.battles
    )
    .slice(0, top);
  const worst = decided
    .filter((s) => s.winRate < 0.5)
    .sort(
      (a, b) =>
        a.winRate - b.winRate ||
        b.decided - a.decided ||
        b.battles - a.battles
    )
    .slice(0, top);
  return { best, worst };
}

/* ---------- 兵種ページ：武将別の勝率比較 ---------- */

/** この兵種を使った武将ごとの戦績。 */
export interface UserWinRate {
  name: string;
  battles: number;
  wins: number;
  losses: number;
  decided: number;
  winRate: number;
}

/**
 * 注目兵種を使った武将ごとに勝率を集計する。
 * 既定では戦闘数の多い順。
 */
export function userWinRates(outcomes: BattleOutcome[]): UserWinRate[] {
  const map = new Map<string, UserWinRate>();
  for (const o of outcomes) {
    const name = o.self.name?.trim();
    if (!name) continue;
    let s = map.get(name);
    if (!s) {
      s = { name, battles: 0, wins: 0, losses: 0, decided: 0, winRate: 0 };
      map.set(name, s);
    }
    s.battles++;
    if (o.result === "win") s.wins++;
    else if (o.result === "loss") s.losses++;
  }
  const arr = Array.from(map.values());
  for (const s of arr) {
    s.decided = s.wins + s.losses;
    s.winRate = s.decided > 0 ? s.wins / s.decided : 0;
  }
  return arr.sort((a, b) => b.battles - a.battles || b.winRate - a.winRate);
}

/* ---------- 兵種ページ：時期別の使用率推移 ---------- */

/** ある時期（ゲーム内年）における兵種の使用状況。 */
export interface UsageTrendPoint {
  /** ゲーム内の年 */
  year: number;
  /** その年に行われた全戦闘数 */
  totalBattles: number;
  /** うち、この兵種が登場した戦闘数 */
  unitBattles: number;
  /** 使用率 0..1（totalBattles が 0 のときは 0） */
  rate: number;
}

/**
 * 指定兵種の「使用率」をゲーム内の年ごとに推移として返す。
 * 使用率 = その年にこの兵種が登場した戦闘数 / その年の全戦闘数。
 * 戦闘の重複（同一戦闘の再登録）は除外し、1 戦闘につき最大 1 回数える。
 */
export function unitUsageTrend(
  log: BattleRecord[],
  unitName: string
): UsageTrendPoint[] {
  const target = unitName.trim();
  const total = new Map<number, number>();
  const used = new Map<number, number>();
  for (const { card } of dedupedCards(log)) {
    const year = gameYear(card);
    if (year == null) continue;
    total.set(year, (total.get(year) ?? 0) + 1);
    const inBattle =
      unitMatches(card.left, target) || unitMatches(card.right, target);
    if (inBattle) used.set(year, (used.get(year) ?? 0) + 1);
  }
  return Array.from(total.entries())
    .map(([year, totalBattles]) => {
      const unitBattles = used.get(year) ?? 0;
      return {
        year,
        totalBattles,
        unitBattles,
        rate: totalBattles > 0 ? unitBattles / totalBattles : 0,
      };
    })
    .sort((a, b) => a.year - b.year);
}

/** この兵種が分類される兵科（最も多く登場した兵科）を返す。 */
export function unitBranchLabel(
  outcomes: BattleOutcome[]
): string | undefined {
  const count = new Map<string, number>();
  for (const o of outcomes) {
    const b = o.self.branch?.trim();
    if (!b) continue;
    count.set(b, (count.get(b) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [b, n] of count) {
    if (n > bestN) {
      best = b;
      bestN = n;
    }
  }
  return best;
}

/* ---------- 撃破加重指数（Sweep Weight Index / SWI） ---------- */

/**
 * 枚抜き枚数 n に対する重み（乗数）。実効値 = n × 乗数。
 *   2枚 ×1.0 / 3枚 ×1.2 / 4枚 ×1.5 / 5枚 ×2.0 / 6枚 ×2.5
 * 1枚は単純な1勝として ×1.0。6枚超は +0.5 刻みで外挿する。
 */
export function sweepMultiplier(n: number): number {
  if (n <= 0) return 0;
  const table: Record<number, number> = {
    1: 1.0,
    2: 1.0,
    3: 1.2,
    4: 1.5,
    5: 2.0,
    6: 2.5,
  };
  return table[n] ?? 2.5 + 0.5 * (n - 6);
}

/** 枚抜き枚数 n の実効値（= n × 乗数）。 */
export function sweepEffectiveValue(n: number): number {
  return n * sweepMultiplier(n);
}

/** 1 出撃（同一攻撃側・同一戦闘時刻）の集約。 */
interface SortieAgg {
  /** 攻撃側として勝利した戦目番号の集合 */
  wins: Set<number>;
}

/**
 * 1 出撃の「枚抜き枚数」= 1戦目から連続で勝った数。
 * 攻撃は 1戦目→2戦目→3戦目 と進むため、最初に勝てなかった時点で止まる。
 */
function sortieSweepCount(s: SortieAgg): number {
  let n = 0;
  // 今期の最大は 3戦目。将来拡張に備え上限は緩めに見る。
  for (let i = 1; i <= 10; i++) {
    if (s.wins.has(i)) n++;
    else break;
  }
  return n;
}

export interface SwiStat {
  /** 攻撃側武将名 */
  name: string;
  faction?: string;
  /** 兵科（騎兵/歩兵など） */
  branch?: string;
  /** 総出兵数（攻撃側として出撃した回数） */
  sorties: number;
  /** 実効値の合計（Σ 枚数 × 重み） */
  weighted: number;
  /** SWI = weighted / sorties */
  swi: number;
  /** 枚抜き枚数ごとの出撃回数（index = 枚数, 0..） */
  sweepCounts: number[];
  /** 最大枚抜き枚数 */
  bestSweep: number;
}

/** 戦目番号（"3戦目" → 3）を数値で返す。取れなければ 0。 */
function battleNoNumber(no: string | undefined): number {
  const m = no?.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * 撃破加重指数（SWI）ランキングを算出する。
 * 出撃 = (攻撃側武将, 戦闘時刻) でまとめた 1 回の攻撃。
 * 各出撃の枚抜き枚数（1戦目からの連勝数）に重みを掛けた実効値を合算し、
 * 総出兵数で割って SWI とする。重複行は除外する。
 *
 * @param minSorties ランキングに載せる最小出撃数（既定 5）
 */
/** ある側（攻撃=left / 守備=right）の視点で集計した武将ごとの SWI 指標。 */
export interface SideSwiStat {
  name: string;
  faction?: string;
  branch?: string;
  /** その側として出撃（同一戦闘時刻でまとめた回数） */
  sorties: number;
  /** 実効値の合計（Σ 枚抜き × 重み） */
  weighted: number;
  /** SWI = weighted / sorties */
  swi: number;
  /** その側で勝った戦目の総数（攻撃なら出兵勝利数 / 守備なら守備勝利数） */
  wins: number;
  /** 枚抜き枚数ごとの出撃回数（index = 枚数, 0..） */
  sweepCounts: number[];
  /** 最大枚抜き枚数 */
  bestSweep: number;
}

/**
 * 指定した側（攻撃 / 守備）の視点で、武将ごとの出撃・連勝（枚抜き）・SWI を集計する。
 * 出撃 = (注目側武将, 戦闘時刻) でまとめた 1 回。枚抜き = 1戦目からの連勝数。
 * 守備側も同様に (防衛側武将, 戦闘時刻) でまとめ、1戦目から連続で守り切った数を
 * 「枚抜き（守備）」として攻撃と同じ重みで評価する。重複行は除外する。
 */
function computeSideSwi(
  log: BattleRecord[],
  side: SideKey
): Map<string, SideSwiStat> {
  // 出撃単位に集約。
  const sorties = new Map<string, SortieAgg>();
  // 武将ごとの最新の勢力・兵科（表示・フィルタ用）。
  const factionOf = new Map<string, string | undefined>();
  const branchOf = new Map<string, string | undefined>();

  for (const { card } of dedupedCards(log)) {
    const self = side === "left" ? card.left : card.right;
    const name = self.name?.trim();
    if (!name) continue;
    const key = `${name}@@${card.battleAt ?? ""}`;
    let s = sorties.get(key);
    if (!s) {
      s = { wins: new Set() };
      sorties.set(key, s);
    }
    if (card.winner === side) s.wins.add(battleNoNumber(card.battleNo));
    if (self.faction) factionOf.set(name, self.faction);
    if (self.branch) branchOf.set(name, self.branch);
  }

  // 武将ごとに集約。
  interface Acc {
    name: string;
    sorties: number;
    weighted: number;
    wins: number;
    sweepCounts: number[];
    bestSweep: number;
  }
  const acc = new Map<string, Acc>();
  for (const [key, s] of sorties) {
    const name = key.slice(0, key.indexOf("@@"));
    let a = acc.get(name);
    if (!a) {
      a = {
        name,
        sorties: 0,
        weighted: 0,
        wins: 0,
        sweepCounts: [],
        bestSweep: 0,
      };
      acc.set(name, a);
    }
    const n = sortieSweepCount(s);
    a.sorties++;
    a.wins += s.wins.size;
    a.weighted += sweepEffectiveValue(n);
    a.sweepCounts[n] = (a.sweepCounts[n] ?? 0) + 1;
    if (n > a.bestSweep) a.bestSweep = n;
  }

  const out = new Map<string, SideSwiStat>();
  for (const a of acc.values()) {
    const sweepCounts = Array.from(
      { length: a.sweepCounts.length },
      (_, i) => a.sweepCounts[i] ?? 0
    );
    out.set(a.name, {
      name: a.name,
      faction: factionOf.get(a.name),
      branch: branchOf.get(a.name),
      sorties: a.sorties,
      weighted: a.weighted,
      swi: a.sorties > 0 ? a.weighted / a.sorties : 0,
      wins: a.wins,
      sweepCounts,
      bestSweep: a.bestSweep,
    });
  }
  return out;
}

export function swiRanking(log: BattleRecord[], minSorties = 5): SwiStat[] {
  return Array.from(computeSideSwi(log, "left").values())
    .filter((a) => a.sorties >= minSorties)
    .map((a) => ({
      name: a.name,
      faction: a.faction,
      branch: a.branch,
      sorties: a.sorties,
      weighted: a.weighted,
      swi: a.swi,
      sweepCounts: a.sweepCounts,
      bestSweep: a.bestSweep,
    }))
    .sort((a, b) => b.swi - a.swi || b.sorties - a.sorties);
}

/* ---------- 武将ランキング（攻撃 / 守備の総合） ---------- */

/** ランキングで切り替えられる指標。 */
export type RankMetric =
  | "attackWins"
  | "defenseWins"
  | "attackSwi"
  | "defenseSwi"
  | "assists";

/** 武将 1 人の攻撃・守備の総合戦績。 */
export interface WarlordRankStat {
  name: string;
  faction?: string;
  branch?: string;
  /** 攻撃側としての出撃回数 */
  attackSorties: number;
  /** 出兵勝利数（攻撃側として勝った戦目の総数） */
  attackWins: number;
  /** SWI（攻撃） */
  attackSwi: number;
  /** 攻撃側の最高枚抜き */
  attackBestSweep: number;
  /** 守備側としての出撃回数 */
  defenseSorties: number;
  /** 守備勝利数（守備側として勝った戦目の総数） */
  defenseWins: number;
  /** SWI（守備） */
  defenseSwi: number;
  /** 守備側の最高枚抜き */
  defenseBestSweep: number;
  /**
   * アシスト数。同一 battleAt のイベントで攻撃側が最終的に少なくとも 1 戦目を制した場合に、
   * 攻撃側が負けたラウンドのうち最多ターン数を稼いだ武将に付与される。
   */
  assists: number;
}

/** 指標値を取り出す。 */
export function rankMetricValue(s: WarlordRankStat, metric: RankMetric): number {
  switch (metric) {
    case "attackWins":
      return s.attackWins;
    case "defenseWins":
      return s.defenseWins;
    case "attackSwi":
      return s.attackSwi;
    case "defenseSwi":
      return s.defenseSwi;
    case "assists":
      return s.assists;
  }
}

/** 指標が攻撃側のものか。 */
export function isAttackMetric(metric: RankMetric): boolean {
  return metric === "attackWins" || metric === "attackSwi";
}

/**
 * 同一 battleAt のイベントで、攻撃側が少なくとも 1 戦目を制した場合に
 * 攻撃側が負けたラウンドのうち最多ターン数だった武将に 1 アシストを付与する。
 * アシストは「苦しい状況で一番粘った攻撃武将」への評価指標。
 */
function computeAssists(log: BattleRecord[]): Map<string, number> {
  // battleAt でイベントをグループ化（battleAt なし は除外）。
  const groups = new Map<string, BattleCard[]>();
  for (const { card } of dedupedCards(log)) {
    const key = card.battleAt ?? "";
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.push(card);
    else groups.set(key, [card]);
  }

  const assists = new Map<string, number>();
  for (const cards of groups.values()) {
    // 攻撃側（left）が少なくとも 1 戦目を制していること（城を落とした or 部分勝利）。
    const attackWonAny = cards.some((c) => c.winner === "left");
    if (!attackWonAny) continue;

    // 攻撃側が負けたラウンドのうち、最多ターン数を稼いだ武将を探す。
    let bestTurns = -1;
    let bestName: string | null = null;
    for (const card of cards) {
      if (card.winner !== "right") continue; // 防衛側が勝った＝攻撃側が負けたラウンドのみ
      const t = card.turns ? parseInt(card.turns, 10) : 0;
      const name = card.left.name?.trim();
      if (!name) continue;
      if (t > bestTurns) {
        bestTurns = t;
        bestName = name;
      }
    }

    if (bestName !== null && bestTurns >= 0) {
      assists.set(bestName, (assists.get(bestName) ?? 0) + 1);
    }
  }

  return assists;
}

/**
 * 武将ごとに攻撃・守備の出撃数 / 勝利数 / SWI をまとめて集計する。
 * 出兵勝利数・守備勝利数はその側で勝った戦目の総数、
 * SWI（攻撃 / 守備）はそれぞれの側を 1戦目からの連勝（枚抜き）で重み付け評価したもの。
 */
export function warlordRanking(log: BattleRecord[]): WarlordRankStat[] {
  const atk = computeSideSwi(log, "left");
  const def = computeSideSwi(log, "right");
  const assistsMap = computeAssists(log);
  const names = new Set<string>([...atk.keys(), ...def.keys()]);
  const out: WarlordRankStat[] = [];
  for (const name of names) {
    const a = atk.get(name);
    const d = def.get(name);
    out.push({
      name,
      faction: a?.faction ?? d?.faction,
      branch: a?.branch ?? d?.branch,
      attackSorties: a?.sorties ?? 0,
      attackWins: a?.wins ?? 0,
      attackSwi: a?.swi ?? 0,
      attackBestSweep: a?.bestSweep ?? 0,
      defenseSorties: d?.sorties ?? 0,
      defenseWins: d?.wins ?? 0,
      defenseSwi: d?.swi ?? 0,
      defenseBestSweep: d?.bestSweep ?? 0,
      assists: assistsMap.get(name) ?? 0,
    });
  }
  return out;
}

/* ---------- 武器・品物（装備）図鑑 ---------- */

/** 装備（武器・品物）1 種の使用実績。 */
export interface EquipStat {
  name: string;
  /** 登場した戦闘数（攻守の延べ） */
  battles: number;
  wins: number;
  losses: number;
  others: number;
  decided: number;
  winRate: number;
  /** 攻撃側で装備した回数 */
  attackUses: number;
  /** 守備側で装備した回数 */
  defenseUses: number;
  /** よく使う武将 TOP3 */
  topUsers: { name: string; count: number }[];
}

/**
 * 戦闘ログの装備枠（武器=装備1 / 品物=装備2）を集計し、装備ごとの使用回数・
 * 勝率・主な使用武将を求める。`pick` で集計対象の枠を選ぶ。攻撃側・守備側の
 * 両方を対象とし、重複行は除外する。「なし」など装備なしは除外する。
 */
function collectEquipStats(
  log: BattleRecord[],
  pick: (side: BattleSide) => string | undefined
): EquipStat[] {
  interface Acc {
    name: string;
    battles: number;
    wins: number;
    losses: number;
    others: number;
    attackUses: number;
    defenseUses: number;
    users: Map<string, number>;
  }
  const map = new Map<string, Acc>();
  const sides: SideKey[] = ["left", "right"];
  for (const { card } of dedupedCards(log)) {
    for (const side of sides) {
      const self = side === "left" ? card.left : card.right;
      const result = outcomeForSide(card.winner, side);
      const raw = pick(self);
      if (!raw) continue;
      const name = normalizeDisplayToken(raw);
      if (!name || name === "なし") continue;
      let e = map.get(name);
      if (!e) {
        e = {
          name,
          battles: 0,
          wins: 0,
          losses: 0,
          others: 0,
          attackUses: 0,
          defenseUses: 0,
          users: new Map(),
        };
        map.set(name, e);
      }
      e.battles++;
      if (result === "win") e.wins++;
      else if (result === "loss") e.losses++;
      else e.others++;
      if (side === "left") e.attackUses++;
      else e.defenseUses++;
      const user = self.name?.trim();
      if (user) e.users.set(user, (e.users.get(user) ?? 0) + 1);
    }
  }
  return Array.from(map.values())
    .map((e) => {
      const decided = e.wins + e.losses;
      const topUsers = Array.from(e.users.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      return {
        name: e.name,
        battles: e.battles,
        wins: e.wins,
        losses: e.losses,
        others: e.others,
        decided,
        winRate: decided > 0 ? e.wins / decided : 0,
        attackUses: e.attackUses,
        defenseUses: e.defenseUses,
        topUsers,
      };
    })
    .sort((a, b) => b.battles - a.battles);
}

/** 武器（ゲームの装備2列）ごとの使用実績を集計する。 */
export function weaponStats(log: BattleRecord[]): EquipStat[] {
  return collectEquipStats(log, (s) => s.equip2);
}

/** 品物（ゲームの装備1列）ごとの使用実績を集計する。 */
export function itemStats(log: BattleRecord[]): EquipStat[] {
  return collectEquipStats(log, (s) => s.equip1);
}

/** 装備枠。weapon=武器(装備2) / item=品物(装備1)。 */
export type EquipSlot = "weapon" | "item";

/** 装備枠に対応する取り出し関数を返す。 */
function equipPick(slot: EquipSlot): (side: BattleSide) => string | undefined {
  return slot === "weapon" ? (s) => s.equip2 : (s) => s.equip1;
}

/** 片側が指定の装備（武器/品物）を装備しているか。 */
function equipMatches(
  side: BattleSide,
  slot: EquipSlot,
  target: string
): boolean {
  const raw = equipPick(slot)(side);
  if (!raw) return false;
  return normalizeDisplayToken(raw) === target;
}

/**
 * 指定の装備（武器=装備2 / 品物=装備1）が使われた戦闘を新しい順で集める。
 * 同じ戦闘で両側が装備していれば 2 件になる（兵種ページと同じ方針）。
 */
export function collectEquipBattles(
  log: BattleRecord[],
  equipName: string,
  slot: EquipSlot
): BattleOutcome[] {
  const target = equipName.trim();
  const out: BattleOutcome[] = [];
  for (const { record, card } of dedupedCards(log)) {
    if (equipMatches(card.left, slot, target))
      out.push(makeOutcome(record, card, "left"));
    if (equipMatches(card.right, slot, target))
      out.push(makeOutcome(record, card, "right"));
  }
  return sortByTimeDesc(out);
}

