import type { Warlord } from "./types";

/**
 * 戦闘履歴 1 行を解析して攻撃側・防衛側の武将情報を取り出す。
 *
 * 実データはタブと半角スペースが混在しており、戦闘部分は 1 つのフィールド内で
 * スペース区切りになっている:
 *   【N戦目】<TAB>年月<TAB>月日 時刻<TAB>場所<TAB>
 *   勢力名 武将名 家名 タイプ 兵種名 兵科 装備1 装備2 V.S. 勢力名 武将名 家名 タイプ 兵種名 兵科 装備1 装備2<TAB>
 *   勝敗<TAB>ターン数
 *
 * そのため区切りの種類に依存せず、行全体を空白（タブ/半角/全角）でまとめて分割し、
 * V.S. の前後 8 トークンずつを攻撃側・防衛側として取り出す。
 */
export function parseBattleLine(line: string): Warlord[] {
  const raw = line.replace(/\r/g, "").trim();
  if (!raw) return [];

  // タブ・半角スペース・全角スペースをまとめて区切りにする。
  const tokens = raw
    .split(/[\s\u3000]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // 【N戦目】 で始まる行のみ対象
  if (tokens.length === 0 || !/^【.*戦目】/.test(tokens[0])) {
    return [];
  }

  // V.S. の位置を見つける
  const vsIndex = tokens.findIndex((t) => /^v\.?s\.?$/i.test(t));
  if (vsIndex < 0) return [];

  // 攻撃側: V.S. の直前 8 トークン
  //   = 勢力名 武将名 家名 タイプ 兵種名 兵科 装備1 装備2
  if (vsIndex < 8) return [];
  const attacker = sliceWarlord(tokens.slice(vsIndex - 8, vsIndex));

  // 防衛側: V.S. の直後 8 トークン（以降に 勝敗 / ターン数 が続く）
  if (tokens.length < vsIndex + 9) return [];
  const defender = sliceWarlord(tokens.slice(vsIndex + 1, vsIndex + 9));

  // 戦闘日時: 先頭の【N戦目】と攻撃側ブロックの間にあるメタ情報のうち
  // 末尾（場所）を除いたもの（年月 月日 時刻）を最終戦闘時刻として扱う。
  const meta = tokens.slice(1, vsIndex - 8);
  const battleAt = (meta.length > 1 ? meta.slice(0, -1) : meta).join(" ");
  // 実時刻部分（例: 06/15 09:30）を行動時刻として抽出。
  const actionAt = extractActionTime(battleAt);

  const now = Date.now();
  const result: Warlord[] = [];
  // 攻撃側（V.S. の左側）のみ「行動時刻」を紐づける。
  if (attacker)
    result.push({
      ...attacker,
      battleAt,
      lastActionAt: actionAt,
      actions: actionAt ? [actionAt] : undefined,
      updatedAt: now,
    });
  if (defender) result.push({ ...defender, battleAt, updatedAt: now });
  return result;
}

/** "1687年5月 06/15 09:30" などから "06/15 09:30" を抽出する。 */
function extractActionTime(s: string): string | undefined {
  const m = s.match(/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/);
  return m ? m[0].replace(/\s+/, " ") : undefined;
}

/**
 * 末尾 8 トークン: [勢力名, 武将名, 家名, タイプ, 兵種名, 兵科, 装備1, 装備2]
 */
function sliceWarlord(
  block: string[]
): Omit<Warlord, "updatedAt" | "battleAt"> | null {
  if (block.length !== 8) return null;
  const [faction, name, , type, unit, branch] = block;
  if (!name || !type || !branch) return null;
  return {
    name: name.trim(),
    faction: faction?.trim() || undefined,
    type: type.trim(),
    branch: branch.trim(),
    unit: normalizeUnit(unit),
  };
}

/**
 * 兵種名を整形する。
 * 先頭に `*` が付く場合（例: `*ノクスミーティア(カノン砲)`）は、
 * 括弧（半角/全角）内のテキストを採用する（例: `カノン砲`）。
 */
function normalizeUnit(unit: string | undefined): string | undefined {
  const u = unit?.trim();
  if (!u) return undefined;
  if (u.startsWith("*")) {
    const m = u.match(/[（(]([^（()）]+)[）)]/);
    if (m && m[1].trim()) return m[1].trim();
  }
  return u;
}

/**
 * 複数行をまとめてパース。
 * 返り値は「最新が後勝ち」になるよう順序通り並んだ Warlord 配列。
 */
export function parseBattleLog(text: string): Warlord[] {
  const lines = text.split(/\n+/);
  const out: Warlord[] = [];
  for (const line of lines) {
    out.push(...parseBattleLine(line));
  }
  return out;
}

export interface BattleEntry {
  /** 生の行テキスト（前後空白除去済み） */
  line: string;
  /** 戦闘時刻（例: 1687年5月 06/15 09:30） */
  time?: string;
  /** この行から取り出した武将 */
  warlords: Warlord[];
}

/**
 * 複数行をパースし、解析できた行ごとに
 * 生テキスト・戦闘時刻・武将情報をまとめて返す。
 */
export function parseBattleEntries(text: string): BattleEntry[] {
  const lines = text.split(/\n+/);
  const out: BattleEntry[] = [];
  for (const line of lines) {
    const warlords = parseBattleLine(line);
    if (warlords.length === 0) continue;
    out.push({
      line: line.replace(/\r/g, "").trim(),
      time: warlords[0]?.battleAt,
      warlords,
    });
  }
  return out;
}
