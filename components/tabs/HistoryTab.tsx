"use client";

import { useEffect, useMemo, useState } from "react";
import type { BattleRecord } from "@/lib/types";
import { parseActionDate } from "@/lib/action";
import {
  parseBattleCard,
  isSpecialToken,
  normalizeDisplayToken,
  extractBattleUrl,
  battleKey,
  type BattleCard,
  type BattleSide,
} from "@/lib/parser";
import { resolveWinColor, type FactionColorMap } from "@/lib/factionColors";
import { htmlToMarkdown, copyText } from "@/lib/clipboard";
import {
  SearchIcon,
  FilterIcon,
  TrophyIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLinkIcon,
  SortIcon,
  CloseIcon,
  CopyIcon,
  CheckIcon,
} from "@/components/icons";

interface Props {
  onRegister: (text: string) => Promise<{
    added: number;
    updated: number;
    parsed: number;
    skipped: number;
  }>;
  log: BattleRecord[];
  factionColors: FactionColorMap;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
}

const PAGE_SIZE = 20;

/** 片側の装備・兵種タグを組み立てる（兵種 → 兵科 → 装備）。
 * `unit: true` のタグ（兵種名）は兵種ページへ遷移できる。 */
function sideTags(
  side: BattleSide
): { text: string; highlight: boolean; unit: boolean }[] {
  const tags: { text: string; highlight: boolean; unit: boolean }[] = [];
  if (side.unit) {
    tags.push({
      text: normalizeDisplayToken(side.unit),
      highlight: isSpecialToken(side.unit),
      unit: true,
    });
  }
  if (side.branch)
    tags.push({ text: side.branch, highlight: false, unit: false });
  for (const e of side.equips) {
    tags.push({
      text: normalizeDisplayToken(e),
      highlight: isSpecialToken(e),
      unit: false,
    });
  }
  return tags;
}

/** カードの検索対象テキスト（生テキスト＋表示用に正規化した語）。小文字化済み。 */
function cardSearchText(
  record: BattleRecord,
  card: BattleCard | null
): string {
  const parts: string[] = [record.line];
  if (card) {
    for (const side of [card.left, card.right]) {
      if (side.name) parts.push(side.name);
      if (side.faction) parts.push(side.faction);
      if (side.branch) parts.push(side.branch);
      if (side.unit) parts.push(normalizeDisplayToken(side.unit));
      for (const e of side.equips) parts.push(normalizeDisplayToken(e));
    }
  }
  return parts.join(" ").toLowerCase();
}

const PLACEHOLDER = `戦闘履歴をここに貼り付けてください。（スマホからのコピー＆ペーストにも対応しています）`;

export function HistoryTab({
  onRegister,
  log,
  factionColors,
  onSelectWarlord,
  onSelectUnit,
}: Props) {
  const [text, setText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [factionFilter, setFactionFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<
    | null
    | {
        kind: "success";
        added: number;
        updated: number;
        parsed: number;
        skipped: number;
      }
    | { kind: "warn"; message: string }
  >(null);
  const [busy, setBusy] = useState(false);

  const handleRegister = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await onRegister(text);
      if (r.parsed === 0) {
        setResult({
          kind: "warn",
          message:
            "解析できる行が見つかりませんでした。タブ区切り・半角スペース区切りのどちらでも登録できます。",
        });
        return;
      }
      setResult({ kind: "success", ...r });
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    setText("");
    setResult(null);
  };

  // ブラウザからコピーした内容を貼り付けたとき、クリップボードの HTML を
  // Markdown に変換してから挿入する。これにより `<a href>` が `[テキスト](URL)`
  // となり、プレーンテキストでは失われる戦闘ログの URL を保持できる。
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    // HTML が無い（プレーンテキスト）場合は通常の貼り付けに任せる。
    if (!html.trim()) return;

    const md = htmlToMarkdown(html);
    if (!md) return;

    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + md + text.slice(end);
    setText(next);

    // 再レンダリング後にカーソル位置を挿入末尾へ復元する。
    const caret = start + md.length;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* 選択範囲の復元失敗は無視 */
      }
    });
  };

  // 各履歴をカード表示用に解析（取得・並びロジックは従来通り）。
  // 内容が同一の行（正規化後に一致）は重複表示しないよう除外する。
  const cards = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      record: BattleRecord;
      card: BattleCard | null;
      search: string;
    }[] = [];
    for (const record of log) {
      const key = battleKey(record.line);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      const card = parseBattleCard(record.line);
      out.push({ record, card, search: cardSearchText(record, card) });
    }
    return out;
  }, [log]);

  // フィルター用の国一覧（カードの左右いずれかに登場する勢力）
  const factionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const { card } of cards) {
      if (card?.left.faction) set.add(card.left.faction);
      if (card?.right.faction) set.add(card.right.faction);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [cards]);

  // 戦闘時刻順で表示（新しい順 / 古い順）。キーワード・国で絞り込み。
  const visibleLog = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const list = cards.filter((item) => {
      if (k && !item.search.includes(k)) return false;
      const { card } = item;
      if (factionFilter) {
        const f =
          card?.left.faction === factionFilter ||
          card?.right.faction === factionFilter;
        if (!f) return false;
      }
      return true;
    });
    const now = new Date();
    const timeOf = (r: BattleRecord) =>
      parseActionDate(r.time, now)?.getTime() ?? null;
    // newest=1（降順）/ oldest=-1（昇順）。時刻が無い行は常に末尾。
    const dir = sortOrder === "newest" ? 1 : -1;
    return [...list].sort((a, b) => {
      const ta = timeOf(a.record);
      const tb = timeOf(b.record);
      if (ta != null && tb != null) {
        if (tb !== ta) return (tb - ta) * dir;
        return (b.record.savedAt - a.record.savedAt) * dir;
      }
      if (ta != null) return -1;
      if (tb != null) return 1;
      return (b.record.savedAt - a.record.savedAt) * dir;
    });
  }, [cards, keyword, factionFilter, sortOrder]);

  const hasActiveFilter = keyword.trim() !== "" || factionFilter !== "";

  const clearFilters = () => {
    setKeyword("");
    setFactionFilter("");
  };

  const totalPages = Math.max(1, Math.ceil(visibleLog.length / PAGE_SIZE));

  // 絞り込み・件数変化でページ範囲を補正
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  // キーワード・国・並び順の変更時は1ページ目へ
  useEffect(() => {
    setPage(1);
  }, [keyword, factionFilter, sortOrder]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleLog.slice(start, start + PAGE_SIZE);
  }, [visibleLog, page]);

  // 表示中の件数範囲（例: 1–20 件目）。
  const rangeStart = visibleLog.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, visibleLog.length);

  return (
    <>
      <section className="panel">
        <h2>戦闘履歴を登録</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          ゲームの戦闘履歴をブラウザからコピーして貼り付け、「登録する」を押してください。
          リンク付き（各戦の詳細ページ URL）も自動で保持されます。
          攻撃側・防衛側どちらの武将も自動で抽出され、同じ内容の行は重複登録されません。
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRegister}
            disabled={!text.trim() || busy}
          >
            {busy ? "登録中…" : "登録する"}
          </button>
          <button type="button" className="btn" onClick={handleClear}>
            クリア
          </button>
        </div>

        {result?.kind === "success" && (
          <div className="stat-grid">
            <div className="stat">
              <div className="label">解析行(武将数)</div>
              <div className="value">{result.parsed}</div>
            </div>
            <div className="stat">
              <div className="label">新規登録</div>
              <div className="value">{result.added}</div>
            </div>
            <div className="stat">
              <div className="label">上書き更新</div>
              <div className="value">{result.updated}</div>
            </div>
            <div className="stat">
              <div className="label">重複スキップ</div>
              <div className="value">{result.skipped}</div>
            </div>
          </div>
        )}
        {result?.kind === "warn" && (
          <div className="tag warn" role="alert">
            {result.message}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="history-head">
          <h2>登録済み戦闘履歴</h2>
          <span className="count-badge">
            {hasActiveFilter
              ? `全${cards.length.toLocaleString("ja-JP")}件中 ${visibleLog.length.toLocaleString("ja-JP")}件`
              : `全${cards.length.toLocaleString("ja-JP")}件`}
          </span>
        </div>

        <div className="search-row">
          <div className="search-box">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              className="text-input search-input"
              placeholder="履歴を絞り込み（武将名など）"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <button
            type="button"
            className="btn sort-toggle"
            onClick={() =>
              setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))
            }
            aria-label={
              sortOrder === "newest"
                ? "並び順: 新しい順（クリックで古い順に切替）"
                : "並び順: 古い順（クリックで新しい順に切替）"
            }
            title="登録日時の並び替え"
          >
            <SortIcon />
            <span>{sortOrder === "newest" ? "新しい順" : "古い順"}</span>
          </button>
          <button
            type="button"
            className={
              "btn filter-toggle" +
              (showFilter || factionFilter ? " active" : "")
            }
            onClick={() => setShowFilter((v) => !v)}
            aria-expanded={showFilter}
          >
            <FilterIcon />
            <span>フィルター</span>
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              className="btn clear-filters"
              onClick={clearFilters}
              title="絞り込み条件をすべて解除"
            >
              <CloseIcon />
              <span>解除</span>
            </button>
          )}
        </div>

        {showFilter && (
          <div className="filter-grid">
            <label className="filter">
              <span>国</span>
              <select
                className="select"
                value={factionFilter}
                onChange={(e) => setFactionFilter(e.target.value)}
              >
                <option value="">すべて</option>
                {factionOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {visibleLog.length === 0 ? (
          log.length === 0 ? (
            <div className="empty">
              <p className="empty-title">まだ戦闘履歴がありません</p>
              <p className="empty-hint">
                上の入力欄にゲームの戦闘履歴を貼り付けて「登録する」を押すと、
                ここに一覧表示されます。リンク付きでコピーすれば詳細ページのURLも保持されます。
              </p>
            </div>
          ) : (
            <div className="empty">
              <p className="empty-title">条件に一致する履歴がありません</p>
              <p className="empty-hint">
                キーワードや国フィルターを変更・解除してください。
              </p>
            </div>
          )
        ) : (
          <>
            <ul className="battle-list">
              {pageItems.map(({ record, card }, i) => (
                <BattleHistoryCard
                  key={`${record.savedAt}-${i}-${record.line.slice(0, 16)}`}
                  record={record}
                  card={card}
                  factionColors={factionColors}
                  onSelectWarlord={onSelectWarlord}
                  onSelectUnit={onSelectUnit}
                />
              ))}
            </ul>

            <div className="pager">
              <button
                type="button"
                className="btn pager-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft />
                <span>前へ</span>
              </button>
              <span className="pager-info">
                {rangeStart.toLocaleString("ja-JP")}–
                {rangeEnd.toLocaleString("ja-JP")} /{" "}
                {visibleLog.length.toLocaleString("ja-JP")}件（{page} /{" "}
                {totalPages}）
              </span>
              <button
                type="button"
                className="btn pager-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <span>次へ</span>
                <ChevronRight />
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

interface CardProps {
  record: BattleRecord;
  card: BattleCard | null;
  factionColors: FactionColorMap;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
}

function BattleHistoryCard({
  record,
  card,
  factionColors,
  onSelectWarlord,
  onSelectUnit,
}: CardProps) {
  // コピー完了の一時表示（フックは早期 return より前で宣言する）
  const [copied, setCopied] = useState(false);

  // 解析できなかった行は生テキストで表示（データを失わない）
  if (!card) {
    const { url } = extractBattleUrl(record.line);
    return (
      <li className="battle-card battle-card--raw">
        {record.time && <span className="bc-time">{record.time}</span>}
        <span className="bc-raw-line">{record.line}</span>
        {url && (
          <a
            className="bc-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLinkIcon />
            <span>詳細を見る</span>
          </a>
        )}
      </li>
    );
  }

  const safeCard = card;

  const winColor = resolveWinColor(
    safeCard.winner,
    safeCard.left.faction,
    safeCard.right.faction,
    factionColors
  );
  const winnerName =
    safeCard.winner === "left"
      ? safeCard.left.name
      : safeCard.winner === "right"
      ? safeCard.right.name
      : "—";
  const resultLabel =
    safeCard.winner === "draw"
      ? "引分"
      : safeCard.winner === "retreat"
      ? "撤退"
      : safeCard.winner === "unknown"
      ? safeCard.resultRaw
      : "勝利";

  // カード余白のクリックで戦闘ログ URL を開く（武将名・兵種ボタンは stopPropagation）。
  const openUrl = () => {
    if (safeCard.url) window.open(safeCard.url, "_blank", "noopener,noreferrer");
  };

  // 戦闘ログの URL をクリップボードへコピー（共有用）。
  const copyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!safeCard.url) return;
    const ok = await copyText(safeCard.url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const renderTeam = (side: BattleSide, align: "left" | "right") => (
    <div className={`bc-team bc-team--${align}`}>
      {side.faction && <span className="bc-faction">{side.faction}</span>}
      <button
        type="button"
        className="bc-name bc-name-btn"
        onClick={(e) => {
          e.stopPropagation();
          onSelectWarlord(side.name);
        }}
        title={`${side.name} の戦績を見る`}
      >
        {side.name}
      </button>
      <div className="bc-tags">
        {sideTags(side).map((t, i) =>
          t.unit ? (
            <button
              key={`${t.text}-${i}`}
              type="button"
              className={"pill pill-btn" + (t.highlight ? " highlight" : "")}
              onClick={(e) => {
                e.stopPropagation();
                onSelectUnit(t.text);
              }}
              title={`${t.text} の戦績を見る`}
            >
              {t.text}
            </button>
          ) : (
            <span
              key={`${t.text}-${i}`}
              className={"pill" + (t.highlight ? " highlight" : "")}
            >
              {t.text}
            </span>
          )
        )}
      </div>
    </div>
  );

  return (
    <li
      className={"battle-card" + (safeCard.url ? " battle-card--link" : "")}
      style={{
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: winColor ?? "var(--border)",
      }}
      onClick={safeCard.url ? openUrl : undefined}
      role={safeCard.url ? "link" : undefined}
      tabIndex={safeCard.url ? 0 : undefined}
      onKeyDown={
        safeCard.url
          ? (e) => {
              if (e.key === "Enter") openUrl();
            }
          : undefined
      }
    >
      <div className="bc-header">
        <div className="bc-header-left">
          {safeCard.battleNo && (
            <span className="bc-badge">{safeCard.battleNo}</span>
          )}
          {safeCard.place && <span className="bc-place">{safeCard.place}</span>}
        </div>
        <div className="bc-header-right">
          {safeCard.turns && (
            <span className="bc-turns">{safeCard.turns}ターン</span>
          )}
          {(safeCard.battleAt || record.time) && (
            <span className="bc-time">{safeCard.battleAt ?? record.time}</span>
          )}
          {safeCard.url && (
            <button
              type="button"
              className={"bc-link-icon bc-copy-btn" + (copied ? " copied" : "")}
              onClick={copyLink}
              aria-label={
                copied ? "リンクをコピーしました" : "戦闘ログのリンクをコピー"
              }
              title={copied ? "コピーしました" : "リンクをコピー"}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
          {safeCard.url && (
            <a
              className="bc-link-icon"
              href={safeCard.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="戦闘ログの詳細を開く"
              title="戦闘ログの詳細を開く"
            >
              <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>

      <div className="bc-vs">
        {renderTeam(safeCard.left, "left")}
        <div className="bc-vs-label">VS</div>
        {renderTeam(safeCard.right, "right")}
      </div>

      <div className="bc-result">
        <span className="bc-result-label">
          <TrophyIcon />
          {resultLabel}
        </span>
        <span
          className="bc-winner"
          style={winColor ? { color: winColor } : undefined}
        >
          {winnerName}
        </span>
      </div>
    </li>
  );
}
