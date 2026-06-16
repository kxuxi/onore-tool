"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BattleRecord, WarlordMap } from "./types";
import { fetchState } from "./api";

export interface DataSyncState {
  db: WarlordMap;
  setDb: Dispatch<SetStateAction<WarlordMap>>;
  battleLog: BattleRecord[];
  setBattleLog: Dispatch<SetStateAction<BattleRecord[]>>;
  hydrated: boolean;
  loadError: boolean;
  refreshing: boolean;
  lastFetchedAt: number | null;
  reload: () => void;
  refresh: () => Promise<void>;
}

/**
 * 共有DBと戦闘履歴の取得・更新を管理するフック。
 * 初回マウント時（および `reload` 呼び出し時）にサーバーからデータを取得し、
 * `refresh` で手動再取得ができる。
 */
export function useDataSync(
  pushToast: (kind: "success" | "error", message: string) => void
): DataSyncState {
  const [db, setDb] = useState<WarlordMap>({});
  const [battleLog, setBattleLog] = useState<BattleRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  // 初回マウント時・再試行時にサーバーから読み込み
  useEffect(() => {
    let active = true;
    setLoadError(false);
    setHydrated(false);
    fetchState()
      .then((state) => {
        if (!active) return;
        setDb(state.db);
        setBattleLog(state.log);
        setLastFetchedAt(Date.now());
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        pushToast("error", "データの読み込みに失敗しました");
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [reloadKey, pushToast]);

  /** 読み込み失敗時の再試行 */
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  /** 共有DBを手動で再取得して最新状態に更新する（画面は維持したまま） */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const state = await fetchState();
      setDb(state.db);
      setBattleLog(state.log);
      setLastFetchedAt(Date.now());
      pushToast("success", "最新の状態に更新しました");
    } catch {
      pushToast("error", "更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  }, [pushToast]);

  return {
    db,
    setDb,
    battleLog,
    setBattleLog,
    hydrated,
    loadError,
    refreshing,
    lastFetchedAt,
    reload,
    refresh,
  };
}
