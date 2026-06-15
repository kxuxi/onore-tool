import type {
  BattleRecord,
  UnitType,
  Warlord,
  WarlordMap,
} from "./types";

export type StateResponse = {
  db: WarlordMap;
  log: BattleRecord[];
};

export type RegisterResponse = StateResponse & {
  added: number;
  updated: number;
  logAdded: number;
  skipped: number;
};

/** 武将DB + 戦闘履歴を取得 */
export async function fetchState(): Promise<StateResponse> {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw new Error("状態の取得に失敗しました");
  return res.json();
}

/** 解析済みの武将・戦闘履歴を登録 */
export async function registerState(
  warlords: Warlord[],
  records: BattleRecord[]
): Promise<RegisterResponse> {
  const res = await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warlords, records }),
  });
  if (!res.ok) throw new Error("登録に失敗しました");
  return res.json();
}

/** 武将DB + 戦闘履歴をリセット */
export async function resetState(): Promise<StateResponse> {
  const res = await fetch("/api/state", { method: "DELETE" });
  if (!res.ok) throw new Error("リセットに失敗しました");
  return res.json();
}

/** 兵種一覧を取得 */
export async function fetchUnitTypes(): Promise<UnitType[]> {
  const res = await fetch("/api/unit-types", { cache: "no-store" });
  if (!res.ok) throw new Error("兵種の取得に失敗しました");
  return res.json();
}

/** 兵種を追加 / 更新（名前が被ったら上書き） */
export async function upsertUnitType(unit: UnitType): Promise<UnitType> {
  const res = await fetch("/api/unit-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(unit),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "兵種の保存に失敗しました");
  }
  return res.json();
}

/** 兵種を削除 */
export async function deleteUnitType(name: string): Promise<void> {
  const res = await fetch(`/api/unit-types/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("兵種の削除に失敗しました");
}
