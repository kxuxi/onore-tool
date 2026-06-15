"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { ScoutTab } from "@/components/tabs/ScoutTab";
import { DbTab } from "@/components/tabs/DbTab";
import { DamageTab } from "@/components/tabs/DamageTab";
import { UnitTab } from "@/components/tabs/UnitTab";
import {
  fetchState,
  registerState,
  resetState,
} from "@/lib/api";
import { parseBattleEntries } from "@/lib/parser";
import type { BattleRecord, TabKey, WarlordMap } from "@/lib/types";

const TABS: { key: TabKey; label: string }[] = [
  { key: "history", label: "戦闘履歴" },
  { key: "scout", label: "偵察検索" },
  { key: "damage", label: "被弾表" },
  { key: "db", label: "DB確認" },
  { key: "units", label: "兵種図鑑" },
];

export default function HomePage() {
  const [tab, setTab] = useState<TabKey>("history");
  const [db, setDb] = useState<WarlordMap>({});
  const [battleLog, setBattleLog] = useState<BattleRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  // 初回マウント時にサーバー（共有DB）から読み込み
  useEffect(() => {
    let active = true;
    fetchState()
      .then((state) => {
        if (!active) return;
        setDb(state.db);
        setBattleLog(state.log);
      })
      .catch(() => {
        if (!active) return;
        setToast({ kind: "error", message: "データの読み込みに失敗しました" });
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // 画面幅に応じてサイドバーの初期表示を切り替え（デスクトップは開、モバイルは閉）
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const apply = (matches: boolean) => {
      setIsMobile(!matches);
      setSidebarOpen(matches);
    };
    apply(mql.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // トースト自動消去
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleRegister = useCallback(
    async (text: string) => {
      const entries = parseBattleEntries(text);
      const warlords = entries.flatMap((e) => e.warlords);
      if (warlords.length === 0) {
        return { added: 0, updated: 0, parsed: 0, skipped: 0 };
      }
      const now = Date.now();
      const records: BattleRecord[] = entries.map((e) => ({
        line: e.line,
        time: e.time,
        savedAt: now,
      }));
      try {
        const res = await registerState(warlords, records);
        setDb(res.db);
        setBattleLog(res.log);
        setToast({
          kind: "success",
          message: `登録: 新規 ${res.added} / 更新 ${res.updated}（履歴 +${res.logAdded} / 重複 ${res.skipped}）`,
        });
        return {
          added: res.added,
          updated: res.updated,
          parsed: warlords.length,
          skipped: res.skipped,
        };
      } catch {
        setToast({ kind: "error", message: "登録に失敗しました" });
        return { added: 0, updated: 0, parsed: warlords.length, skipped: 0 };
      }
    },
    []
  );

  const handleReset = useCallback(async () => {
    try {
      const state = await resetState();
      setDb(state.db);
      setBattleLog(state.log);
      setToast({ kind: "success", message: "DBをリセットしました" });
    } catch {
      setToast({ kind: "error", message: "リセットに失敗しました" });
    }
  }, []);

  const selectTab = useCallback(
    (key: TabKey) => {
      setTab(key);
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  const content = useMemo(() => {
    switch (tab) {
      case "history":
        return <HistoryTab onRegister={handleRegister} log={battleLog} />;
      case "scout":
        return <ScoutTab db={db} />;
      case "damage":
        return <DamageTab db={db} />;
      case "db":
        return <DbTab db={db} onReset={handleReset} />;
      case "units":
        return <UnitTab />;
      default:
        return null;
    }
  }, [tab, db, battleLog, handleRegister, handleReset]);

  return (
    <div className={"app" + (sidebarOpen ? " sidebar-open" : "")}>
      <header className="header">
        <div className="header-left">
          <button
            type="button"
            className="hamburger"
            aria-label={sidebarOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <h1>
            己鯖 武将DBツール
            <span className="sub">v1</span>
          </h1>
        </div>
        <HamburgerMenu onResetDb={handleReset} />
      </header>

      <div className="body">
        {isMobile && sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <aside
          className="sidebar"
          role="navigation"
          aria-label="メインメニュー"
          aria-hidden={!sidebarOpen}
        >
          <nav className="nav" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                tabIndex={sidebarOpen ? 0 : -1}
                className={"nav-item" + (tab === t.key ? " active" : "")}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main">
          {hydrated ? (
            content
          ) : (
            <div className="panel">
              <p className="muted" style={{ margin: 0 }}>
                読み込み中…
              </p>
            </div>
          )}
        </main>
      </div>

      {toast && <div className={"toast " + toast.kind}>{toast.message}</div>}
    </div>
  );
}
