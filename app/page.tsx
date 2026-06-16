"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  loadThemePref,
  saveThemePref,
  resolveTheme,
  applyTheme,
  COLOR_SCHEME_QUERY,
  type ThemePref,
} from "@/lib/theme";
import { copyText } from "@/lib/clipboard";
import { ShareIcon, CheckIcon, RefreshIcon, ChevronUp } from "@/components/icons";
import type { BattleRecord, TabKey, WarlordMap } from "@/lib/types";

const TABS: { key: TabKey; label: string }[] = [
  { key: "history", label: "戦闘履歴" },
  { key: "scout", label: "偵察検索" },
  { key: "damage", label: "被弾表" },
  { key: "swi", label: "武将ランキング" },
  { key: "db", label: "DB確認" },
  { key: "units", label: "兵種図鑑" },
  { key: "weapons", label: "武器図鑑" },
  { key: "items", label: "品物図鑑" },
  { key: "nations", label: "国" },
  { key: "factions", label: "環境設定" },
];

/** 武将 / 兵種 / 武器 / 品物 ページの表示状態 */
type DetailView = {
  kind: "warlord" | "unit" | "weapon" | "item" | "faction";
  name: string;
};

/** 詳細ページの種類ごとの共有URLクエリのキー。 */
const DETAIL_PARAM: Record<DetailView["kind"], string> = {
  warlord: "w",
  unit: "u",
  weapon: "wp",
  item: "it",
  faction: "f",
};

/** デスクトップでのサイドバー開閉の好みを保存する localStorage キー。 */
const SIDEBAR_KEY = "onore.sidebarOpen";

/** 画面右下に積み重ねて表示する通知トースト。 */
type ToastMsg = { id: number; kind: "success" | "error"; message: string };

/** トースト自動消去のミリ秒（成功のみ。エラーは手動で閉じるまで残す）。 */
const TOAST_AUTO_DISMISS_MS = 2400;

/** 1件のトースト。成功は一定時間で自動消去するが、ホバー/フォーカス中は消さない。 */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMsg;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    // エラーは重要なので自動消去しない。ホバー/フォーカス中も消さない。
    if (toast.kind === "error" || paused) return;
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      TOAST_AUTO_DISMISS_MS
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.kind, paused, onDismiss]);
  return (
    <div
      className={"toast " + toast.kind}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="通知を閉じる"
      >
        ×
      </button>
    </div>
  );
}

/** タブ・詳細ページの状態を共有用 URL クエリへ変換する。 */
function buildShareQuery(tab: TabKey, detail: DetailView | null): string {
  const params = new URLSearchParams();
  if (tab !== "history") params.set("tab", tab);
  if (detail) params.set(DETAIL_PARAM[detail.kind], detail.name);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** URL クエリからタブ・詳細スタックを復元する（共有リンク・履歴の戻る/進むで共用）。 */
function navStateFromSearch(search: string): {
  tab: TabKey;
  detailStack: DetailView[];
} {
  const params = new URLSearchParams(search);
  const t = params.get("tab");
  // 旧「武器・品物」タブ（equips）の共有リンクは武器図鑑へ寄せる。
  const tabKey = t === "equips" ? "weapons" : t;
  const tab: TabKey =
    tabKey && TABS.some((x) => x.key === tabKey) ? (tabKey as TabKey) : "history";
  const w = params.get("w");
  const u = params.get("u");
  const wp = params.get("wp");
  const it = params.get("it");
  const f = params.get("f");
  let detailStack: DetailView[] = [];
  if (w) detailStack = [{ kind: "warlord", name: w }];
  else if (u) detailStack = [{ kind: "unit", name: u }];
  else if (wp) detailStack = [{ kind: "weapon", name: wp }];
  else if (it) detailStack = [{ kind: "item", name: it }];
  else if (f) detailStack = [{ kind: "faction", name: f }];
  return { tab, detailStack };
}

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
  // テーマの好み（自動 / ライト / ダーク）。実際の適用は data-theme で行う。
  const [themePref, setThemePref] = useState<ThemePref>("auto");
  // 詳細ページ（武将 / 兵種）はスタックで管理し、相互リンクの「戻る」を自然にする。
  const [detailStack, setDetailStack] = useState<DetailView[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastSeq = useRef(0);
  // トーストを積み増す（最大4件まで。古いものから捨てる）。
  const pushToast = useCallback(
    (kind: "success" | "error", message: string) => {
      const id = ++toastSeq.current;
      setToasts((prev) => [...prev, { id, kind, message }].slice(-4));
    },
    []
  );
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
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
  // タブリストのロービングタブインデックス用の参照。
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const detail = detailStack[detailStack.length - 1] ?? null;

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

  // テーマの好みをローカルから読み込み、解決して適用する。
  useEffect(() => {
    const pref = loadThemePref();
    setThemePref(pref);
    applyTheme(resolveTheme(pref));
  }, []);

  // 「自動」のときは時間帯の境界（昼/夜）をまたいでも追従するよう定期的に再適用する。
  useEffect(() => {
    if (themePref !== "auto") return;
    const id = window.setInterval(() => {
      applyTheme(resolveTheme("auto"));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [themePref]);

  // 「OSに合わせる」のときは、OSの外観設定の変更に即時追従する。
  useEffect(() => {
    if (themePref !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(COLOR_SCHEME_QUERY);
    const onChange = () => applyTheme(resolveTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePref]);

  // テーマの好みを変更して保存・即時適用する。
  const handleChangeTheme = useCallback((pref: ThemePref) => {
    setThemePref(pref);
    saveThemePref(pref);
    applyTheme(resolveTheme(pref));
  }, []);

  // 初回マウント時に URL クエリからタブ・詳細ページを復元（共有リンク・再読込対応）
  const justRestored = useRef(false);
  useEffect(() => {
    const { tab: t, detailStack: stack } = navStateFromSearch(
      window.location.search
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
    const qs = buildShareQuery(tab, detail);
    const url = window.location.pathname + qs;
    const navState = { tab, detailStack };
    if (justRestored.current || fromPopState.current) {
      justRestored.current = false;
      fromPopState.current = false;
      window.history.replaceState(navState, "", url);
      return;
    }
    window.history.pushState(navState, "", url);
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
        const { tab: t, detailStack: stack } = navStateFromSearch(
          window.location.search
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
      const label = TABS.find((t) => t.key === tab)?.label;
      document.title = label ? `${label}｜${base}` : base;
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

  // タブリストのキーボード操作（↑↓←→ / Home / End でタブ移動）。
  const onTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const idx = TABS.findIndex((t) => t.key === tab);
      let next = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight")
        next = (idx + 1) % TABS.length;
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
        next = (idx - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = TABS.length - 1;
      else return;
      e.preventDefault();
      selectTab(TABS[next].key);
      tabRefs.current[next]?.focus();
    },
    [tab, selectTab]
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

  // 武器ページ / 品物ページを開く。
  const selectEquip = useCallback(
    (name: string, slot: "weapon" | "item") => {
      const n = name.trim();
      if (!n) return;
      setDetailStack((s) => {
        const top = s[s.length - 1];
        if (top && top.kind === slot && top.name === n) return s;
        return [...s, { kind: slot, name: n }];
      });
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile]
  );

  // 国（勢力）ページを開く。
  const selectFaction = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      setDetailStack((s) => {
        const top = s[s.length - 1];
        if (top && top.kind === "faction" && top.name === n) return s;
        return [...s, { kind: "faction", name: n }];
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
            {TABS.map((t, i) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="main-panel"
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                tabIndex={sidebarOpen && tab === t.key ? 0 : -1}
                className={"nav-item" + (tab === t.key ? " active" : "")}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <main
          className="main"
          id="main-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
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
            detailView ?? content
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

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </div>
  );
}
