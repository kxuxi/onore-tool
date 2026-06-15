import type { Warlord } from "./types";

/**
 * テキストを 1 戦闘ごとのセグメントに分割する。
 * 区切りは「【N戦目】」マーカー。改行の有無に依存せず、マーカーの直前で
 * 分割するため、マークダウン形式で複数戦が 1 行に連結されていても対応できる。
 */
export function splitBattleSegments(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?=【[^】]*戦目】)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * マークダウンのリンク記法 `[本文](URL)` を検出して URL を取り出し、
 * 本文を通常のスペース区切り行へ正規化する。
 *
 * ゲーム履歴をリンク付きでコピーすると
 *   【N戦目】年月MM/DD HH:mm場所[攻撃側 V.S. 防衛側](URL)勝敗Nターンで終了
 * のように日時・場所・勝敗が詰まった形で貼られる。リンク外側の詰まりを
 * 区切り直して、既存のトークン解析がそのまま使えるようにする。
 *
 * リンクが無ければ入力をそのまま返す（従来のタブ区切り形式に対応）。
 */
export function extractBattleUrl(line: string): { line: string; url?: string } {
  const m = line.match(/\[([\s\S]*?)\]\((https?:\/\/[^)\s]+)\)/);
  if (!m) return { line };

  const url = m[2];
  const linkText = m[1];
  const start = m.index ?? 0;
  const before = line.slice(0, start);
  const after = line.slice(start + m[0].length);

  // リンク前: 【N戦目】 / 年月 / 月日 時刻 / 場所 の境界を区切り直す。
  const pre = before
    .replace(/】/g, "】 ")
    .replace(/(\d+年\d+月)/g, "$1 ")
    .replace(/(\d{1,2}:\d{2})(?=\S)/g, "$1 ");
  // リンク後: 勝敗 と「Nターン」の境界を区切り直す。
  const post = after.replace(/(\d+)\s*ターン/g, " $1 ターン");

  const normalized = `${pre} ${linkText} ${post}`
    .replace(/[\s\u3000]+/g, " ")
    .trim();
  return { line: normalized, url };
}

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
  const { line: raw } = extractBattleUrl(line.replace(/\r/g, "").trim());
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
 * 先頭に `*` が付く場合（例: `*ノクスミーティア(カノン砲)`）や
 * 「オリジナル兵」と書かれている場合（例: `オリジナル兵(ドラグーン)`）は、
 * 括弧（半角/全角）内のテキストを採用する（例: `カノン砲` / `ドラグーン`）。
 */
function normalizeUnit(unit: string | undefined): string | undefined {
  const u = unit?.trim();
  if (!u) return undefined;
  if (u.startsWith("*") || u.includes("オリジナル兵")) {
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
  const out: Warlord[] = [];
  for (const seg of splitBattleSegments(text)) {
    out.push(...parseBattleLine(seg));
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
  const out: BattleEntry[] = [];
  for (const seg of splitBattleSegments(text)) {
    const warlords = parseBattleLine(seg);
    if (warlords.length === 0) continue;
    // seg はマークダウンのリンク（URL）を含む原文のまま保持し、
    // 保存・表示時に URL を取り出せるようにする。
    out.push({
      line: seg,
      time: warlords[0]?.battleAt,
      warlords,
    });
  }
  return out;
}

/** 勝者側 */
export type BattleWinner = "left" | "right" | "draw" | "retreat" | "unknown";

/** カード表示用の片側（攻撃側 / 防衛側）情報 */
export interface BattleSide {
  faction?: string;
  name: string;
  family?: string;
  type: string;
  /** 兵種名（`*` 付きの特殊兵種を含む生テキスト） */
  unit?: string;
  branch: string;
  /** 装備（空・プレースホルダーは除去済み） */
  equips: string[];
}

/** 1 戦闘行をカード表示用に構造化したもの */
export interface BattleCard {
  /** 例: "1戦目" */
  battleNo?: string;
  /** 場所 */
  place?: string;
  /** 戦闘時刻（例: 1583年4月 10:23） */
  battleAt?: string;
  /** ターン数 */
  turns?: string;
  left: BattleSide;
  right: BattleSide;
  /** どちらが勝ったか */
  winner: BattleWinner;
  /** 勝敗の生テキスト（例: 勝利 / 敗北 / 引分） */
  resultRaw: string;
  /** 戦闘ログ詳細ページの URL（マークダウン形式で貼られた場合のみ） */
  url?: string;
}

/** トークンが特殊アイテム（`*` 始まり）かどうか */
export function isSpecialToken(token: string): boolean {
  return token.trim().startsWith("*");
}

/**
 * 表示用にトークンを整形する。
 * `*` 始まり、または「オリジナル兵」を含む場合は括弧内テキストを採用する。
 * `*` 始まりで括弧が無ければ `*` を取り除く。
 */
export function normalizeDisplayToken(token: string): string {
  const t = token.trim();
  if (t.startsWith("*") || t.includes("オリジナル兵")) {
    const m = t.match(/[（(]([^（()）]+)[）)]/);
    if (m && m[1].trim()) return m[1].trim();
    if (t.startsWith("*")) return t.slice(1).trim();
  }
  return t;
}

function cleanToken(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t && t !== "なし" && t !== "-" && t !== "ー" ? t : undefined;
}

function sideFromBlock(block: string[]): BattleSide {
  const [faction, name, family, type, unit, branch, e1, e2] = block;
  return {
    faction: cleanToken(faction),
    name: name?.trim() ?? "",
    family: cleanToken(family),
    type: type?.trim() ?? "",
    unit: unit?.trim() || undefined,
    branch: branch?.trim() ?? "",
    equips: [e1, e2]
      .map((e) => cleanToken(e))
      .filter((e): e is string => !!e),
  };
}

/**
 * 1 戦闘行をカード表示用に解析する。解析できない行は null。
 * トークン構造は parseBattleLine と同じ規則に従う。
 */
export function parseBattleCard(line: string): BattleCard | null {
  const { line: raw, url } = extractBattleUrl(line.replace(/\r/g, "").trim());
  if (!raw) return null;

  const tokens = raw
    .split(/[\s\u3000]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0 || !/^【.*戦目】/.test(tokens[0])) return null;

  const vsIndex = tokens.findIndex((t) => /^v\.?s\.?$/i.test(t));
  if (vsIndex < 8) return null;
  if (tokens.length < vsIndex + 9) return null;

  const left = sideFromBlock(tokens.slice(vsIndex - 8, vsIndex));
  const right = sideFromBlock(tokens.slice(vsIndex + 1, vsIndex + 9));
  if (!left.name || !right.name) return null;

  // 先頭【N戦目】〜攻撃側ブロックの間が [年月, 月日, 時刻, 場所]。末尾を場所とみなす。
  const meta = tokens.slice(1, vsIndex - 8);
  const place = meta.length > 1 ? meta[meta.length - 1] : undefined;
  const battleAt = (meta.length > 1 ? meta.slice(0, -1) : meta).join(" ");

  const resultRaw = tokens[vsIndex + 9] ?? "";
  const turnsRaw = tokens[vsIndex + 10];
  const turns = turnsRaw && /^\d+$/.test(turnsRaw) ? turnsRaw : undefined;

  // 勝敗カラムは「{勝者名}の勝利」または「撤退」の形式。
  // 勝者名は左右いずれかの武将名と一致するため、名前で勝者側を判定する。
  let winner: BattleWinner = "unknown";
  const winMatch = resultRaw.match(/^(.+?)の勝利$/);
  if (winMatch) {
    const w = winMatch[1].trim();
    if (w === left.name) winner = "left";
    else if (w === right.name) winner = "right";
    else winner = "unknown";
  } else if (/撤退/.test(resultRaw)) {
    winner = "retreat";
  } else if (/分/.test(resultRaw)) {
    winner = "draw";
  }

  const battleNo = tokens[0].replace(/[【】[\]]/g, "").trim() || undefined;

  return {
    battleNo,
    place: cleanToken(place),
    battleAt: battleAt || undefined,
    turns,
    left,
    right,
    winner,
    resultRaw: resultRaw || "不明",
    url,
  };
}

/**
 * 戦闘の重複判定に使う正規化キー。
 *
 * 同じ戦闘でも「ターン数」や「URL リンク」の有無など表記が異なると
 * 行テキストが変わってしまうため、行全体ではなく戦闘の同一性を表す
 * 情報（戦闘時刻・場所・両者の武将名と勢力・勝敗）からキーを組み立てる。
 * これによりターン数や URL の差異だけが違う同一戦闘は 1 件にまとまる。
 *
 * カードとして解析できない行は、従来どおり空白を圧縮した行全体をキーにする。
 */
export function battleKey(line: string): string {
  const card = parseBattleCard(line);
  if (!card) {
    return line
      .replace(/\r/g, "")
      .replace(/[\s\u3000]+/g, " ")
      .trim();
  }
  return [
    card.battleAt ?? "",
    card.place ?? "",
    card.left.faction ?? "",
    card.left.name,
    card.right.faction ?? "",
    card.right.name,
    card.winner,
  ].join("|");
}

