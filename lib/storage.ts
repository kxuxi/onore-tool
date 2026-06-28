import type { Warlord, WarlordMap } from "./types";
import { parseActionDate } from "./action";

/**
 * 既存 DB に Warlord 配列をマージ。
 * 配列の後ろにあるものほど新しい想定で、同名は上書き。
 * @returns マージ後の DB と、新規登録数 / 上書き数
 */
export function mergeWarlords(
  existing: WarlordMap,
  incoming: Warlord[]
): { map: WarlordMap; added: number; updated: number } {
  const map: WarlordMap = { ...existing };
  const now = new Date();
  let added = 0;
  let updated = 0;
  for (const w of incoming) {
    const prev = map[w.name];
    if (prev) updated++;
    else added++;

    // 行動時刻の履歴をマージ（昇順・重複なし・直近20件まで保持）。
    const actions = mergeActions(prev?.actions, w.actions);
    const lastActionAt =
      actions.length > 0
        ? actions[actions.length - 1]
        : pickLatestAction(prev?.lastActionAt, w.lastActionAt);

    // 属性（国・タイプ・兵科・兵種・装備）は「在ゲームで新しい戦闘」の方を採用する。
    // 攻撃・守備のどちらで観測したかは問わず、最新の戦闘で見えたプロフィールを反映する。
    const base = isNewerBattle(w, prev, now) ? w : prev ?? w;

    map[w.name] = {
      ...base,
      // 行動履歴・登録時刻・期番号は常に最新へ更新
      lastActionAt,
      actions: actions.length > 0 ? actions : undefined,
      term: w.term ?? prev?.term,
      updatedAt: Math.max(prev?.updatedAt ?? 0, w.updatedAt),
      // 家督名は新しい方を採用（未設定なら既存値を保持）
      household: w.household ?? prev?.household,
      // 能力値・自己PR は戦闘登録では渡らないため、既存値を保持する。
      power: w.power ?? prev?.power,
      intelligence: w.intelligence ?? prev?.intelligence,
      leadership: w.leadership ?? prev?.leadership,
      politics: w.politics ?? prev?.politics,
      strategy: w.strategy ?? prev?.strategy,
      selfPr: w.selfPr ?? prev?.selfPr,
      statsRaw: w.statsRaw ?? prev?.statsRaw,
    };
  }
  return { map, added, updated };
}

/**
 * 武将 w の戦闘が prev より新しい（または同じ）かを判定する。
 *
 * 新旧は「在ゲーム年月」（battleAt 先頭の "1706年1月" 等）を最優先で比較する。
 * 実時刻（MM/DD HH:mm）は登録時の now に依存して年跨ぎ補正が変わるため、
 * 過去ログの一括登録や再登録の際に古い戦闘が新しい戦闘を上書きしてしまい、
 * 攻撃のみならず守備で観測した最新プロフィールが反映されない原因になる。
 * 在ゲーム年月は戦闘が実際に行われた順序そのものなので、攻守を問わず
 * 「在ゲームで最新の戦闘」のプロフィール（兵種・装備など）を採用できる。
 *
 * 在ゲーム年月が同じ、または取得できない場合のみ従来どおり実時刻で比較する。
 * prev が無い、または比較可能な情報が無い場合は true。
 */
function isNewerBattle(
  w: Warlord,
  prev: Warlord | undefined,
  now: Date
): boolean {
  if (!prev) return true;
  // 1) 在ゲーム年月で比較（登録順・登録時刻に依存しない安定した基準）。
  const wg = gameOrderOf(w.battleAt);
  const pg = gameOrderOf(prev.battleAt);
  if (wg != null && pg != null && wg !== pg) return wg > pg;
  // 2) 同じ在ゲーム年月、または年月が取れない場合は実時刻で決める。
  const wd = parseActionDate(extractTime(w.battleAt), now);
  const pd = parseActionDate(extractTime(prev.battleAt), now);
  if (!pd) return true;
  if (!wd) return false;
  return wd.getTime() >= pd.getTime();
}

/**
 * battleAt 先頭の在ゲーム年月（"1706年1月" など）を順序値 year*12+month に変換する。
 * 年月を取り出せない場合は null。
 */
function gameOrderOf(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*年\s*(\d+)\s*月/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return year * 12 + month;
}

/** "1687年5月 06/15 09:30" などから "06/15 09:30" を取り出す。 */
function extractTime(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/);
  return m ? m[0] : undefined;
}

/**
 * 2 つの行動時刻履歴をマージする。
 * "MM/DD HH:mm" のゼロ埋め固定長なので辞書順 = 時刻順。
 * 重複を除き昇順ソートし、直近 20 件に丸める。
 */
function mergeActions(
  a: string[] | undefined,
  b: string[] | undefined
): string[] {
  const set = new Set<string>();
  for (const x of a ?? []) if (x) set.add(x);
  for (const x of b ?? []) if (x) set.add(x);
  return Array.from(set)
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
    .slice(-20);
}

/**
 * 2 つの行動時刻（"06/15 09:30" 形式）のうち新しい方を返す。
 * ゼロ埋め固定長 (MM/DD HH:mm) のため辞書順比較で時刻順になる。
 */
function pickLatestAction(
  a: string | undefined,
  b: string | undefined
): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return b >= a ? b : a;
}

/** 武将名で DB を引く（前後の空白除去・全角空白許容） */
export function lookup(map: WarlordMap, name: string): Warlord | undefined {
  const key = name.trim();
  if (!key) return undefined;
  return map[key];
}

/**
 * 同じ household を持つ武将を1つの代表名に正規化するマップを作成する。
 * 各 household について、最新の updatedAt を持つ武将を代表として選ぶ。
 * household が空の武将は、名前をそのまま返す。
 */
export function normalizationMap(map: WarlordMap): Record<string, string> {
  const byHousehold = new Map<string | undefined, { name: string; updatedAt: number }[]>();

  // household でグループ化
  for (const w of Object.values(map)) {
    const key = w.household || undefined;
    if (!byHousehold.has(key)) {
      byHousehold.set(key, []);
    }
    byHousehold.get(key)!.push({ name: w.name, updatedAt: w.updatedAt });
  }

  // 各グループで最新の代表を決定
  const result: Record<string, string> = {};
  for (const [household, warlords] of byHousehold) {
    const latest = warlords.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
    for (const w of warlords) {
      result[w.name] = latest.name;
    }
  }
  return result;
}

/**
 * 指定した武将と同じ household を持つ全ての武将名を返す（自身を含む）。
 * household が未設定の場合は自身の名前のみを返す。
 */
export function householdAliases(map: WarlordMap, name: string): string[] {
  const warlord = map[name];
  if (!warlord?.household) return [name];
  const household = warlord.household;
  return Object.values(map)
    .filter((w) => w.household === household)
    .map((w) => w.name);
}
