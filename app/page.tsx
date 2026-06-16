"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { HistoryTab } from "@/components/tabs/HistoryTab";
import { ScoutTab } from "@/components/tabs/ScoutTab";
import { DbTab } from "@/components/tabs/DbTab";
import { DamageTab } from "@/components/tabs/DamageTab";
import { UnitTab } from "@/components/tabs/UnitTab";
import { EquipTab } from "@/components/tabs/EquipTab";
import { NationTab } from "@/components/tabs/NationTab";
import { SettingsTab } from "@/components/tabs/SettingsTab";
import { SwiTab } from "@/components/tabs/SwiTab";
import { WarlordDetail } from "@/components/detail/WarlordDetail";
import { UnitDetail } from "@/components/detail/UnitDetail";
import { EquipDetail } from "@/components/detail/EquipDetail";
import { FactionDetail } from "@/components/detail/FactionDetail";
import { registerState, importWarlordStats } from "@/lib/api";
import { parseBattleEntriesChecked } from "@/lib/parser";
import {
  loadFactionColors,
  saveFactionColors,
  type FactionColorMap,
} from "@/lib/factionColors";
import { copyText } from "@/lib/clipboard";
import { TAB_LABELS, TAB_GROUPS, GROUP_OF_TAB, type TabGroupKey } from "@/lib/tabs";
import { useToasts } from "@/lib/useToasts";
import { useTheme } from "@/lib/useTheme";
import { useDataSync } from "@/lib/useDataSync";
import { useAppNavigation } from "@/lib/useAppNavigation";
import { useSidebarLayout } from "@/lib/useSidebarLayout";
import { ToastStack } from "@/components/Toasts";
import {
  ShareIcon,
  CheckIcon,
  RefreshIcon,
  ChevronUp,
  SunIcon,
  MoonIcon,
  HistoryIcon,
  SearchIcon,
  ShieldIcon,
  TrophyIcon,
  DatabaseIcon,
  UsersIcon,
  SwordIcon,
  PackageIcon,
  FlagIcon,
  SlidersIcon,
  BookIcon,
} from "@/components/icons";
import type { BattleRecord, TabKey, WarlordMap } from "@/lib/types";

/** タブ（リーフ）ごとのアイコン。サイドバーのグループ単独表示とページ内サブタブで共用。 */
const TAB_ICONS: Record<TabKey, ReactNode> = {
  history: <HistoryIcon />,
  scout: <SearchIcon />,
  damage: <ShieldIcon />,
  swi: <TrophyIcon />,
  db: <DatabaseIcon />,
  units: <UsersIcon />,
  weapons: <SwordIcon />,
  items: <PackageIcon />,
  nations: <FlagIcon />,
  factions: <SlidersIcon />,
};

/** サイドバーのグループごとのアイコン（JSX なので描画側に置く）。 */
const GROUP_ICONS: Record<TabGroupKey, ReactNode> = {
  history: <HistoryIcon />,
  warlords: <UsersIcon />,
  ranking: <TrophyIcon />,
  encyclopedia: <BookIcon />,
  nations: <FlagIcon />,
  settings: <SlidersIcon />,
};

/** 共有DBを最後に取得した時刻を HH:MM 表記にする。 */
function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  // 通知トーストの状態管理
  const { toasts, pushToast, dismissToast } = useToasts();
  // テーマ（好み・解決結果・切替）
  const {
    themePref,
    resolvedTheme,
    setTheme: handleChangeTheme,
    toggleTheme,
  } = useTheme();
  // 共有DB・戦闘履歴の取得・更新
  const {
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
  } = useDataSync(pushToast);
  // サイドバーの開閉とモバイル判定
  const { sidebarOpen, setSidebarOpen, isMobile, toggleSidebar } =
    useSidebarLayout();
  // モバイルでのナビゲーション時にサイドバーを閉じるコールバック
  const closeSidebarOnMobile = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, setSidebarOpen]);
  // タブ・詳細ページの状態と URL 同期
  const {
    tab,
    detailStack,
    setDetailStack,
    detail,
    activeGroup,
    activeGroupDef,
    groupTabs,
    hasSubtabs,
    tabRefs,
    subTabRefs,
    selectTab,
    selectGroup,
    onTabKeyDown,
    onSubTabKeyDown,
    selectWarlord,
    selectUnit,
    selectEquip,
    selectFaction,
    backDetail,
  } = useAppNavigation({ onCloseSidebar: closeSidebarOnMobile });

  const [factionColors, setFactionColors] = useState<FactionColorMap>({});
  const [linkCopied, setLinkCopied] = useState(false);
  const [showTop, setShowTop] = useState(false);

  // 国カラー設定をローカルから読み込み
  useEffect(() => {
    setFactionColors(loadFactionColors());
  }, []);

  // Escape で詳細ページを1つ戻る／モバイルのサイドバーを閉じる。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detailStack.length > 0) {
        setDetailStack((s) => s.slice(0, -1));
      } else if (isMobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailStack.length, isMobile, sidebarOpen, setDetailStack, setSidebarOpen]);

  // タブ・詳細ページに応じてブラウザのタイトルを更新する（履歴・共有で分かりやすく）。
  useEffect(() => {
    const base = "ONORE ANALYTICS";
    if (detail) {
      document.title = `${detail.name}｜${base}`;
    } else {
      const group = TAB_GROUPS.find((g) => g.key === GROUP_OF_TAB[tab]);
      const leaf = TAB_LABELS[tab];
      const label =
        group && group.tabs.length > 1 ? `${group.label} ${leaf}` : leaf;
      document.title = `${label}｜${base}`;
    }
  }, [detail, tab]);

  // タブ切替・詳細遷移時は本文の先頭へスクロールする。
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [tab, detail]);

  // 一定量スクロールしたら「先頭へ戻る」FABを表示する。
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const handleChangeFactionColors = useCallback((next: FactionColorMap) => {
    setFactionColors(next);
    saveFactionColors(next);
  }, []);

  const handleShareLink = useCallback(async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    }
  }, []);

  const handleRegister = useCallback(
    async (text: string) => {
      const { entries, rejected } = parseBattleEntriesChecked(text);
      const warlords = entries.flatMap((e) => e.warlords);
      const rejectedCount = rejected.length;
      // 項目の過不足を検出した行は登録せず、トーストで警告する。
      const rejectMessage =
        rejectedCount > 0
          ? `項目の過不足を検出しました（${
              rejected[0].battleNo ?? "1件目"
            }: ${rejected[0].reason}${
              rejectedCount > 1 ? ` ほか${rejectedCount - 1}件` : ""
            }）。該当の戦闘は登録していません。`
          : "";
      if (warlords.length === 0) {
        if (rejectedCount > 0) {
          pushToast("error", rejectMessage);
        }
        return {
          added: 0,
          updated: 0,
          parsed: 0,
          skipped: 0,
          rejected: rejectedCount,
        };
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
        if (rejectedCount > 0) {
          pushToast(
            "error",
            `${rejectMessage} 正常分（新規 ${res.added} / 更新 ${res.updated}）は登録しました。`
          );
        } else {
          pushToast(
            "success",
            `登録: 新規 ${res.added} / 更新 ${res.updated}（履歴 +${res.logAdded} / 重複 ${res.skipped}）`
          );
        }
        return {
          added: res.added,
          updated: res.updated,
          parsed: warlords.length,
          skipped: res.skipped,
          rejected: rejectedCount,
        };
      } catch (e) {
        pushToast("error", "登録に失敗しました");
        // 呼び出し側（HistoryTab）で入力を保持しエラー表示できるよう再送出する。
        throw e;
      }
    },
    [pushToast, setDb, setBattleLog]
  );

  const handleImportStats = useCallback(
    async (
      stats: Parameters<typeof importWarlordStats>[0],
      skipped = 0
    ): Promise<{ updated: number; created: number }> => {
      const res = await importWarlordStats(stats);
      setDb(res.db);
      if (skipped > 0) {
        pushToast(
          "error",
          `能力値取り込み: 項目の過不足により ${skipped}行をスキップしました。正常分（更新 ${res.updated} / 新規 ${res.created}）は取り込みました。`
        );
      } else {
        pushToast(
          "success",
          `能力値取り込み: 更新 ${res.updated} / 新規 ${res.created}`
        );
      }
      return { updated: res.updated, created: res.created };
    },
    [pushToast, setDb]
  );

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
        return (
          <ScoutTab
            db={db}
            colors={factionColors}
            onSelectWarlord={selectWarlord}
          />
        );
      case "damage":
        return (
          <DamageTab
            db={db}
            colors={factionColors}
            onSelectWarlord={selectWarlord}
          />
        );
      case "swi":
        return <SwiTab log={battleLog} onSelectWarlord={selectWarlord} />;
      case "db":
        return <DbTab db={db} colors={factionColors} onSelectWarlord={selectWarlord} onSelectFaction={selectFaction} onImportStats={handleImportStats} />;
      case "units":
        return <UnitTab onSelectUnit={selectUnit} />;
      case "weapons":
        return (
          <EquipTab
            variant="weapon"
            log={battleLog}
            onSelectWarlord={selectWarlord}
            onSelectEquip={(name) => selectEquip(name, "weapon")}
          />
        );
      case "items":
        return (
          <EquipTab
            variant="item"
            log={battleLog}
            onSelectWarlord={selectWarlord}
            onSelectEquip={(name) => selectEquip(name, "item")}
          />
        );
      case "nations":
        return (
          <NationTab
            db={db}
            log={battleLog}
            colors={factionColors}
            onSelectFaction={selectFaction}
          />
        );
      case "factions":
        return (
          <SettingsTab
            db={db}
            colors={factionColors}
            onChangeColors={handleChangeFactionColors}
            onSelectFaction={selectFaction}
            themePref={themePref}
            onChangeTheme={handleChangeTheme}
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
    themePref,
    handleRegister,
    handleImportStats,
    handleChangeFactionColors,
    handleChangeTheme,
    selectWarlord,
    selectUnit,
    selectEquip,
    selectFaction,
  ]);

  let detailView: React.ReactNode = null;
  if (detail) {
    if (detail.kind === "warlord") {
      detailView = (
        <WarlordDetail
          name={detail.name}
          db={db}
          log={battleLog}
          colors={factionColors}
          onSelectWarlord={selectWarlord}
          onSelectUnit={selectUnit}
          onSelectFaction={selectFaction}
          onBack={backDetail}
        />
      );
    } else if (detail.kind === "unit") {
      detailView = (
        <UnitDetail
          name={detail.name}
          log={battleLog}
          onSelectWarlord={selectWarlord}
          onSelectUnit={selectUnit}
          onBack={backDetail}
        />
      );
    } else if (detail.kind === "faction") {
      detailView = (
        <FactionDetail
          name={detail.name}
          db={db}
          log={battleLog}
          colors={factionColors}
          onSelectWarlord={selectWarlord}
          onSelectUnit={selectUnit}
          onBack={backDetail}
        />
      );
    } else {
      detailView = (
        <EquipDetail
          name={detail.name}
          slot={detail.kind}
          log={battleLog}
          onSelectWarlord={selectWarlord}
          onSelectUnit={selectUnit}
          onBack={backDetail}
        />
      );
    }
  }

  return (
    <div className={"app" + (sidebarOpen ? " sidebar-open" : "")}>
      <a href="#main-panel" className="skip-link">
        本文へスキップ
      </a>
      <header className="header">
        <div className="header-left">
          <button
            type="button"
            className="hamburger"
            aria-label={sidebarOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
          >
            <span />
            <span />
            <span />
          </button>
          <h1>
            <button
              type="button"
              className="brand-btn"
              onClick={() => selectTab("history")}
              title="ホーム（戦闘履歴）へ"
            >
              ONORE ANALYTICS
            </button>
          </h1>
        </div>
        <div className="header-actions">
          {lastFetchedAt != null && (
            <span
              className="header-fetched muted"
              title="共有DBを最後に取得した時刻"
            >
              最終取得 {formatClock(lastFetchedAt)}
            </span>
          )}
          <button
            type="button"
            className="btn header-theme"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "ライトモードに切り替え"
                : "ダークモードに切り替え"
            }
            title={
              resolvedTheme === "dark"
                ? "ライトモードに切り替え"
                : "ダークモードに切り替え"
            }
          >
            {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className={"btn header-refresh" + (refreshing ? " is-refreshing" : "")}
            onClick={refresh}
            disabled={refreshing || !hydrated}
            aria-label="共有DBを最新に更新"
            title="共有DBを最新に更新"
          >
            <RefreshIcon />
            <span>{refreshing ? "更新中…" : "更新"}</span>
          </button>
          <button
            type="button"
            className={"btn header-share" + (linkCopied ? " copied" : "")}
            onClick={handleShareLink}
            aria-label={
              linkCopied ? "リンクをコピーしました" : "このページのリンクをコピー"
            }
            title={linkCopied ? "コピーしました" : "リンクをコピー"}
          >
            {linkCopied ? <CheckIcon /> : <ShareIcon />}
            <span>{linkCopied ? "コピー済み" : "共有"}</span>
          </button>
        </div>
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
          <nav
            className="nav"
            role="tablist"
            aria-orientation="vertical"
            aria-label="メインメニュー"
            onKeyDown={onTabKeyDown}
          >
            {TAB_GROUPS.map((g, i) => (
              <button
                key={g.key}
                type="button"
                role="tab"
                id={`group-${g.key}`}
                aria-selected={activeGroup === g.key}
                aria-controls="main-panel"
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                tabIndex={sidebarOpen && activeGroup === g.key ? 0 : -1}
                className={"nav-item" + (activeGroup === g.key ? " active" : "")}
                onClick={() => selectGroup(g.key)}
              >
                <span className="nav-item-icon" aria-hidden="true">
                  {GROUP_ICONS[g.key]}
                </span>
                <span className="nav-item-label">{g.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main
          className="main"
          id="main-panel"
          role="tabpanel"
          aria-labelledby={hasSubtabs ? `subtab-${tab}` : `group-${activeGroup}`}
          tabIndex={-1}
        >
          {!hydrated ? (
            <div className="panel" aria-busy="true" aria-live="polite">
              <span className="sr-only">読み込み中…</span>
              <div className="skeleton skeleton-title" />
              <div className="skeleton-grid" aria-hidden="true">
                <div className="skeleton skeleton-stat" />
                <div className="skeleton skeleton-stat" />
                <div className="skeleton skeleton-stat" />
                <div className="skeleton skeleton-stat" />
              </div>
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line skeleton-line--80" />
              <div className="skeleton skeleton-line skeleton-line--60" />
            </div>
          ) : loadError ? (
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>データを読み込めませんでした</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                サーバー（共有DB）への接続に失敗しました。時間をおいて再度お試しください。
              </p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={reload}>
                  再読み込み
                </button>
              </div>
            </div>
          ) : (
            detailView ?? (
              <>
                {hasSubtabs && (
                  <div
                    role="tablist"
                    aria-label={`${activeGroupDef.label}の表示切替`}
                    aria-orientation="horizontal"
                    className="subtabs"
                    onKeyDown={onSubTabKeyDown}
                  >
                    {groupTabs.map((leaf, i) => (
                      <button
                        key={leaf}
                        type="button"
                        role="tab"
                        id={`subtab-${leaf}`}
                        aria-selected={tab === leaf}
                        aria-controls="main-panel"
                        ref={(el) => {
                          subTabRefs.current[i] = el;
                        }}
                        tabIndex={tab === leaf ? 0 : -1}
                        className={"subtab" + (tab === leaf ? " active" : "")}
                        onClick={() => selectTab(leaf)}
                      >
                        <span className="subtab-icon" aria-hidden="true">
                          {TAB_ICONS[leaf]}
                        </span>
                        <span className="subtab-label">{TAB_LABELS[leaf]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {content}
              </>
            )
          )}
        </main>
      </div>

      {showTop && (
        <button
          type="button"
          className="back-to-top"
          onClick={scrollToTop}
          aria-label="先頭へ戻る"
          title="先頭へ戻る"
        >
          <ChevronUp />
        </button>
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
