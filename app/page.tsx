"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchState, registerState, importWarlordStats } from "@/lib/api";
import { parseBattleEntriesChecked } from "@/lib/parser";
import {
  loadFactionColors,
  saveFactionColors,
  type FactionColorMap,
} from "@/lib/factionColors";
import { copyText } from "@/lib/clipboard";
import {
  TAB_LABELS,
  TAB_GROUPS,
  GROUP_OF_TAB,
  type TabGroupKey,
} from "@/lib/tabs";
import {
  buildPath,
  navStateFromLocation,
  type DetailView,
} from "@/lib/navigation";
import { useToasts } from "@/lib/useToasts";
import { useTheme } from "@/lib/useTheme";
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

/** デスクトップでのサイドバー開閉の好みを保存する localStorage キー。 */
const SIDEBAR_KEY = "onore.sidebarOpen";

/** 共有DBを最後に取得した時刻を HH:MM 表記にする。 */
function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const [tab, setTab] = useState<TabKey>("history");
  const [db, setDb] = useState<WarlordMap>({});
  const [battleLog, setBattleLog] = useState<BattleRecord[]>([]);
  const [factionColors, setFactionColors] = useState<FactionColorMap>({});
  // テーマ（好み・解決結果・切替）はフックに集約。setTheme は従来の onChangeTheme として使う。
  const {
    themePref,
    resolvedTheme,
    setTheme: handleChangeTheme,
    toggleTheme,
  } = useTheme();
  // 詳細ページ（武将 / 兵種）はスタックで管理し、相互リンクの「戻る」を自然にする。
  const [detailStack, setDetailStack] = useState<DetailView[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // 通知トーストの状態管理はフックに集約。
  const { toasts, pushToast, dismissToast } = useToasts();
  // 初期読み込みの失敗表示・再試行用。reloadKey を変えると取得 useEffect が再実行される。
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // ヘッダーの「共有」ボタンのコピー完了表示。
  const [linkCopied, setLinkCopied] = useState(false);
  // 共有DBの手動再取得中表示。
  const [refreshing, setRefreshing] = useState(false);
  // 共有DBを最後に取得できた時刻（ヘッダーに表示）。
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  // 縦に長い画面で「先頭へ戻る」FABを表示するか。
  const [showTop, setShowTop] = useState(false);
  // サイドバーのグループ（ロービングタブインデックス）用の参照。
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // ページ内サブタブ（セグメント）のロービングタブインデックス用の参照。
  const subTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // グループごとに最後に開いていたリーフタブ。グループ再選択時に復元する。
  const [lastLeaf, setLastLeaf] = useState<Record<TabGroupKey, TabKey>>(() => {
    const init = {} as Record<TabGroupKey, TabKey>;
    for (const g of TAB_GROUPS) init[g.key] = g.tabs[0];
    return init;
  });

  const detail = detailStack[detailStack.length - 1] ?? null;
  // 現在のリーフタブが属するグループと、その兄弟リーフ一覧。
  const activeGroup = GROUP_OF_TAB[tab];
  const activeGroupDef = TAB_GROUPS.find((g) => g.key === activeGroup)!;
  const groupTabs = activeGroupDef.tabs;
  const hasSubtabs = groupTabs.length > 1;

  // タブが変わったら、そのグループの「最後に開いたリーフ」を更新する。
  useEffect(() => {
    setLastLeaf((prev) =>
      prev[GROUP_OF_TAB[tab]] === tab
        ? prev
        : { ...prev, [GROUP_OF_TAB[tab]]: tab }
    );
  }, [tab]);

  // 初回マウント時・再試行時にサーバー（共有DB）から読み込み
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

  // 読み込み失敗時の再試行（取得 useEffect を再実行する）。
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // 共有DBを手動で再取得して最新状態に更新する（画面は維持したまま）。
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

  // サイドバーの開閉。デスクトップでの好みは localStorage に保存して次回以降復元する。
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      if (!isMobile) {
        try {
          window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
        } catch {
          /* localStorage 不可（プライベートモード等）でも開閉自体は動作させる */
        }
      }
      return next;
    });
  }, [isMobile]);

  // 国カラー設定をローカルから読み込み
  useEffect(() => {
    setFactionColors(loadFactionColors());
  }, []);

  // 初回マウント時に URL からタブ・詳細ページを復元（共有リンク・再読込対応）
  const justRestored = useRef(false);
  useEffect(() => {
    const { tab: t, detailStack: stack } = navStateFromLocation(
      window.location
    );
    // 既定（戦闘履歴・詳細なし）と異なる場合のみ復元する。
    if (t !== "history" || stack.length > 0) {
      justRestored.current = true;
      setTab(t);
      setDetailStack(stack);
    }
  }, []);

  // タブ・詳細ページの変化を履歴へ反映する。
  // 前進ナビ（タブ切替・詳細を開く/積む）は pushState で履歴を積み、
  // 復元・戻る/進む由来の変化は replaceState に留めて二重登録を防ぐ。
  // これによりブラウザ／端末の「戻る」で詳細やタブを行き来できる。
  const firstUrlSync = useRef(true);
  const fromPopState = useRef(false);
  useEffect(() => {
    if (firstUrlSync.current) {
      firstUrlSync.current = false;
      return;
    }
    const path = buildPath(tab, detail);
    const navState = { tab, detailStack };
    if (justRestored.current || fromPopState.current) {
      justRestored.current = false;
      fromPopState.current = false;
      // 復元直後は、旧クエリ付き共有リンクをクリーンなスラッグURLへ正規化する。
      window.history.replaceState(navState, "", path);
      return;
    }
    window.history.pushState(navState, "", path);
  }, [tab, detail, detailStack]);

  // ブラウザ／端末の戻る・進むでタブ・詳細を行き来する。
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      fromPopState.current = true;
      const st = e.state as
        | { tab?: TabKey; detailStack?: DetailView[] }
        | null;
      if (st && typeof st.tab === "string") {
        setTab(st.tab);
        setDetailStack(Array.isArray(st.detailStack) ? st.detailStack : []);
      } else {
        // state を持たないエントリ（直リンク初期エントリ等）は URL から復元。
        const { tab: t, detailStack: stack } = navStateFromLocation(
          window.location
        );
        setTab(t);
        setDetailStack(stack);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleChangeFactionColors = useCallback((next: FactionColorMap) => {
    setFactionColors(next);
    saveFactionColors(next);
  }, []);

  // 現在表示中のページ（タブ・詳細）の URL をクリップボードへコピーする。
  const handleShareLink = useCallback(async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    }
  }, []);

  // 画面幅に応じてサイドバーの初期表示を切り替え（デスクトップは記憶した好み／既定で開、モバイルは閉）
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    // デスクトップでの開閉の好み（保存が無ければ開く）。
    const readDesktopPref = () => {
      try {
        const v = window.localStorage.getItem(SIDEBAR_KEY);
        return v === null ? true : v === "1";
      } catch {
        return true;
      }
    };
    const apply = (isDesktop: boolean) => {
      setIsMobile(!isDesktop);
      // デスクトップは保存した好みを復元。モバイルはオーバーレイのため常に閉じる。
      setSidebarOpen(isDesktop ? readDesktopPref() : false);
    };
    apply(mql.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
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
  }, [detailStack.length, isMobile, sidebarOpen]);

  // モバイルでサイドバー展開中は背景（body）のスクロールをロックする。
  useEffect(() => {
    if (!(isMobile && sidebarOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, sidebarOpen]);

  // タブ・詳細ページに応じてブラウザのタイトルを更新する（履歴・共有で分かりやすく）。
  useEffect(() => {
    const base = "ONORE ANALYTICS";
    if (detail) {
      document.title = `${detail.name}｜${base}`;
    } else {
      // 複数リーフのグループはタイトルに「グループ リーフ」を併記して分かりやすくする。
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
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? "auto" : "smooth" });
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
        // 取り込めるエントリが無い。過不足行があれば警告のみ出す。
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
          // 正常分は登録しつつ、過不足の警告を優先表示する（エラー扱いで残す）。
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
    [pushToast]
  );

  const handleImportStats = useCallback(
    async (
      stats: Parameters<typeof importWarlordStats>[0],
      skipped = 0
    ): Promise<{ updated: number; created: number }> => {
      const res = await importWarlordStats(stats);
      setDb(res.db);
      if (skipped > 0) {
        // 項目の過不足で取り込めなかった行があれば警告（エラー扱いで残す）。
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
    [pushToast]
  );

  const selectTab = useCallback(
    (key: TabKey) => {
      setTab(key);
      setDetailStack([]);
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  // サイドバーのグループを選ぶ。複数リーフのグループは前回開いていたリーフへ復元する。
  const selectGroup = useCallback(
    (g: TabGroupKey) => {
      const def = TAB_GROUPS.find((x) => x.key === g)!;
      selectTab(lastLeaf[g] ?? def.tabs[0]);
    },
    [lastLeaf, selectTab]
  );

  // サイドバー（縦のグループ一覧）のキーボード操作（↑↓ / Home / End）。
  const onTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const idx = TAB_GROUPS.findIndex((g) => g.key === activeGroup);
      let next = -1;
      if (e.key === "ArrowDown") next = (idx + 1) % TAB_GROUPS.length;
      else if (e.key === "ArrowUp")
        next = (idx - 1 + TAB_GROUPS.length) % TAB_GROUPS.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = TAB_GROUPS.length - 1;
      else return;
      e.preventDefault();
      selectGroup(TAB_GROUPS[next].key);
      tabRefs.current[next]?.focus();
    },
    [activeGroup, selectGroup]
  );

  // ページ内サブタブ（横のセグメント）のキーボード操作（←→ / Home / End）。
  const onSubTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const idx = groupTabs.indexOf(tab);
      let next = -1;
      if (e.key === "ArrowRight") next = (idx + 1) % groupTabs.length;
      else if (e.key === "ArrowLeft")
        next = (idx - 1 + groupTabs.length) % groupTabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = groupTabs.length - 1;
      else return;
      e.preventDefault();
      selectTab(groupTabs[next]);
      subTabRefs.current[next]?.focus();
    },
    [groupTabs, tab, selectTab]
  );

  // 詳細ページ（武将 / 兵種 / 武器 / 品物 / 国）を開く共通処理。
  // 同じ対象が既に最前面なら積まない。モバイルではサイドバーを閉じる。
  const openDetail = useCallback(
    (kind: DetailView["kind"], name: string) => {
      const n = name.trim();
      if (!n) return;
      setDetailStack((s) => {
        const top = s[s.length - 1];
        if (top && top.kind === kind && top.name === n) return s;
        return [...s, { kind, name: n }];
      });
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  // 各詳細ページを開く薄いラッパー（子コンポーネントへ渡すコールバックの形に合わせる）。
  const selectWarlord = useCallback(
    (name: string) => openDetail("warlord", name),
    [openDetail]
  );
  const selectUnit = useCallback(
    (name: string) => openDetail("unit", name),
    [openDetail]
  );
  const selectEquip = useCallback(
    (name: string, slot: "weapon" | "item") => openDetail(slot, name),
    [openDetail]
  );
  const selectFaction = useCallback(
    (name: string) => openDetail("faction", name),
    [openDetail]
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
