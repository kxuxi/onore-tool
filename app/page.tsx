"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { ScoutTab } from "@/components/tabs/ScoutTab";
import { DbTab } from "@/components/tabs/DbTab";
import { DamageTab } from "@/components/tabs/DamageTab";
import { UnitTab } from "@/components/tabs/UnitTab";
import { FactionTab } from "@/components/tabs/FactionTab";
import { WarlordDetail } from "@/components/detail/WarlordDetail";
import { UnitDetail } from "@/components/detail/UnitDetail";
import {
  fetchState,
  registerState,
  resetState,
} from "@/lib/api";
import { parseBattleEntries } from "@/lib/parser";
import {
  loadFactionColors,
  saveFactionColors,
  type FactionColorMap,
} from "@/lib/factionColors";
import type { BattleRecord, TabKey, WarlordMap } from "@/lib/types";

const TABS: { key: TabKey; label: string }[] = [
  { key: "history", label: "戦闘履歴" },
  { key: "scout", label: "偵察検索" },
  { key: "damage", label: "被弾表" },
  { key: "db", label: "DB確認" },
  { key: "units", label: "兵種図鑑" },
  { key: "factions", label: "国カラー" },
];

/** 武将ページ / 兵種ページの表示状態 */
type DetailView = { kind: "warlord" | "unit"; name: string };

/** タブ・詳細ページの状態を共有用 URL クエリへ変換する。 */
function buildShareQuery(tab: TabKey, detail: DetailView | null): string {
  const params = new URLSearchParams();
  if (tab !== "history") params.set("tab", tab);
  if (detail) params.set(detail.kind === "warlord" ? "w" : "u", detail.name);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default function HomePage() {
  const [tab, setTab] = useState<TabKey>("history");
  const [db, setDb] = useState<WarlordMap>({});
  const [battleLog, setBattleLog] = useState<BattleRecord[]>([]);
  const [factionColors, setFactionColors] = useState<FactionColorMap>({});
  // 詳細ページ（武将 / 兵種）はスタックで管理し、相互リンクの「戻る」を自然にする。
  const [detailStack, setDetailStack] = useState<DetailView[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const detail = detailStack[detailStack.length - 1] ?? null;

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

  // 国カラー設定をローカルから読み込み
  useEffect(() => {
    setFactionColors(loadFactionColors());
  }, []);

  // 初回マウント時に URL クエリからタブ・詳細ページを復元（共有リンク・再読込対応）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
    const w = params.get("w");
    const u = params.get("u");
    if (w) setDetailStack([{ kind: "warlord", name: w }]);
    else if (u) setDetailStack([{ kind: "unit", name: u }]);
  }, []);

  // タブ・詳細ページの変化を URL へ反映（履歴は汚さず replaceState）。
  // 初回マウントは復元結果と一致するためスキップする。
  const firstUrlSync = useRef(true);
  useEffect(() => {
    if (firstUrlSync.current) {
      firstUrlSync.current = false;
      return;
    }
    const qs = buildShareQuery(tab, detail);
    window.history.replaceState(null, "", window.location.pathname + qs);
  }, [tab, detail]);

  const handleChangeFactionColors = useCallback((next: FactionColorMap) => {
    setFactionColors(next);
    saveFactionColors(next);
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
      setDetailStack([]);
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  // 武将ページを開く（同じ対象が既に最前面なら何もしない）。
  const selectWarlord = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      setDetailStack((s) => {
        const top = s[s.length - 1];
        if (top && top.kind === "warlord" && top.name === n) return s;
        return [...s, { kind: "warlord", name: n }];
      });
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  // 兵種ページを開く。
  const selectUnit = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      setDetailStack((s) => {
        const top = s[s.length - 1];
        if (top && top.kind === "unit" && top.name === n) return s;
        return [...s, { kind: "unit", name: n }];
      });
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  const backDetail = useCallback(() => {
    setDetailStack((s) => s.slice(0, -1));
  }, []);

  const content = useMemo(() => {
    switch (tab) {
      case "history":
        return (
          <HistoryTab
            onRegister={handleRegister}
            log={battleLog}
            factionColors={factionColors}
            onSelectWarlord={selectWarlord}
            onSelectUnit={selectUnit}
          />
        );
      case "scout":
        return <ScoutTab db={db} onSelectWarlord={selectWarlord} />;
      case "damage":
        return <DamageTab db={db} />;
      case "db":
        return (
          <DbTab db={db} onReset={handleReset} onSelectWarlord={selectWarlord} />
        );
      case "units":
        return <UnitTab onSelectUnit={selectUnit} />;
      case "factions":
        return (
          <FactionTab
            db={db}
            colors={factionColors}
            onChange={handleChangeFactionColors}
          />
        );
      default:
        return null;
    }
  }, [
    tab,
    db,
    battleLog,
    factionColors,
    handleRegister,
    handleReset,
    handleChangeFactionColors,
    selectWarlord,
    selectUnit,
  ]);

  const detailView = detail ? (
    detail.kind === "warlord" ? (
      <WarlordDetail
        name={detail.name}
        db={db}
        log={battleLog}
        onSelectWarlord={selectWarlord}
        onSelectUnit={selectUnit}
        onBack={backDetail}
      />
    ) : (
      <UnitDetail
        name={detail.name}
        log={battleLog}
        onSelectWarlord={selectWarlord}
        onSelectUnit={selectUnit}
        onBack={backDetail}
      />
    )
  ) : null;

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
            detailView ?? content
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
