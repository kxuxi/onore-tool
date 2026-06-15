export type TabKey = "history" | "scout" | "db" | "damage";

export interface Warlord {
  /** 武将名（プライマリキー） */
  name: string;
  /** 所属している国（勢力名） */
  faction?: string;
  /** タイプ: 武特 / 統特 / 知特 / 武統 / 統知 / 知武 / 政治家 / 謎 など */
  type: string;
  /** 兵科: 騎兵 / 歩兵 / 弓兵 / 万能 / 妖怪 など */
  branch: string;
  /** 兵種名 (例: 重騎兵 など) — 参考情報 */
  unit?: string;
  /** 戦闘履歴上の年月 + 時刻（生文字列） */
  battleAt?: string;
  /** 攻撃側（左側）として登場した最新の行動時刻（例: 06/15 09:30） */
  lastActionAt?: string;
  /** 攻撃側として登場した行動時刻の履歴（昇順・重複なし） */
  actions?: string[];
  /** ローカル登録時刻（ミリ秒） */
  updatedAt: number;
}

export type WarlordMap = Record<string, Warlord>;

/** 登録した戦闘履歴の 1 行（生データ） */
export interface BattleRecord {
  /** 生の行テキスト（タブ等を含む、前後空白は除去済み） */
  line: string;
  /** 表示用の戦闘時刻（例: 1687年5月 06/15 09:30） */
  time?: string;
  /** ローカル保存時刻（ミリ秒） */
  savedAt: number;
}
