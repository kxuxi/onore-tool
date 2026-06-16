/**
 * 武将ごとの「一言コメント」（プレイヤーの自由記述メモ）。
 * 個人的なメモのため共有 DB ではなくブラウザの localStorage に保存する。
 */
export type WarlordNotes = Record<string, string>;

const KEY = "onore-tool:warlord-notes:v1";

export function loadWarlordNotes(): WarlordNotes {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as WarlordNotes;
    }
    return {};
  } catch {
    return {};
  }
}

function saveWarlordNotes(notes: WarlordNotes): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // 容量超過(QuotaExceededError)やプライベートモード等で書き込みに失敗しても
    // 致命的ではないため、load 側と対称に握りつぶす。
  }
}

/** 指定武将のコメントを取得する（無ければ空文字）。 */
export function getWarlordNote(name: string): string {
  const key = name.trim();
  if (!key) return "";
  return loadWarlordNotes()[key] ?? "";
}

/** 指定武将のコメントを保存する。空文字なら削除する。 */
export function setWarlordNote(name: string, text: string): void {
  const key = name.trim();
  if (!key) return;
  const notes = loadWarlordNotes();
  const value = text.trim();
  if (value) notes[key] = value;
  else delete notes[key];
  saveWarlordNotes(notes);
}
