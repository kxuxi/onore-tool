"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeDisplayToken } from "@/lib/parser";
import { outcomeYear } from "@/lib/stats";
import type { BattleOutcome, OutcomeResult } from "@/lib/stats";
import type { BattleSide } from "@/lib/parser";
import { copyText } from "@/lib/clipboard";
import {
  ExternalLinkIcon,
  CopyIcon,
  CheckIcon,
  ChevronLeft,
  ChevronRight,
} from "@/components/icons";

/** 1 ページあたりの戦闘ログ表示件数。 */
const PAGE_SIZE = 20;

interface Props {
  outcomes: BattleOutcome[];
  /** 強調表示する武将名（武将ページ） */
  currentName?: string;
  /** 強調表示する兵種名（兵種ページ） */
  currentUnit?: string;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
}

function resultLabel(o: BattleOutcome): string {
  if (o.result === "win") return "勝利";
  if (o.result === "loss") return "敗北";
  if (o.card.winner === "retreat") return "撤退";
  if (o.card.winner === "draw") return "引分";
  return "不明";
}

/** 戦闘ログ行の操作ボタン群（リンクコピー・詳細を開く）。行ごとにコピー状態を持つ。 */
function LogRowActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="dl-actions">
      <button
        type="button"
        className={"dl-link dl-copy" + (copied ? " copied" : "")}
        onClick={copy}
        aria-label={
          copied ? "リンクをコピーしました" : "戦闘ログのリンクをコピー"
        }
        title={copied ? "コピーしました" : "リンクをコピー"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <a
        className="dl-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="戦闘ログの詳細を開く"
        title="戦闘ログの詳細を開く"
      >
        <ExternalLinkIcon />
      </a>
    </div>
  );
}

interface ChipProps {
  side: BattleSide;
  currentName?: string;
  currentUnit?: string;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
}

function SideChip({
  side,
  currentName,
  currentUnit,
  onSelectWarlord,
  onSelectUnit,
}: ChipProps) {
  const unit = side.unit ? normalizeDisplayToken(side.unit) : undefined;
  const nameActive = !!currentName && side.name === currentName;
  const unitActive = !!currentUnit && unit === currentUnit;
  return (
    <span className="dl-chip">
      <button
        type="button"
        className={"dl-name" + (nameActive ? " active" : "")}
        onClick={() => onSelectWarlord(side.name)}
        title={`${side.name} の戦績を見る`}
      >
        {side.name}
      </button>
      {unit && (
        <button
          type="button"
          className={"dl-unit" + (unitActive ? " active" : "")}
          onClick={() => onSelectUnit(unit)}
          title={`${unit} の戦績を見る`}
        >
          {unit}
        </button>
      )}
    </span>
  );
}

export function BattleLogList({
  outcomes,
  currentName,
  currentUnit,
  onSelectWarlord,
  onSelectUnit,
}: Props) {
  // 戦闘に含まれるゲーム内の年（新しい順）。年フィルタの選択肢に使う。
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const o of outcomes) {
      const y = outcomeYear(o);
      if (y != null) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [outcomes]);
  const minYear = years.length ? years[years.length - 1] : 0;
  const maxYear = years.length ? years[0] : 0;

  // 取得する年の範囲（既定は全期間 = 最小〜最大）。
  const [fromYear, setFromYear] = useState(minYear);
  const [toYear, setToYear] = useState(maxYear);
  const [page, setPage] = useState(1);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // データが変わって年の範囲が変わったら、選択を全期間へ戻す。
  useEffect(() => {
    setFromYear(minYear);
    setToYear(maxYear);
  }, [minYear, maxYear]);

  const lo = Math.min(fromYear, toYear);
  const hi = Math.max(fromYear, toYear);
  const isFiltered = lo !== minYear || hi !== maxYear;

  // 年の範囲で絞り込む。範囲を狭めた場合のみ「年が不明な戦闘」を除外する。
  const filtered = useMemo(() => {
    if (!isFiltered) return outcomes;
    return outcomes.filter((o) => {
      const y = outcomeYear(o);
      if (y == null) return false;
      return y >= lo && y <= hi;
    });
  }, [outcomes, isFiltered, lo, hi]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // 絞り込みの変化でページをリセットし、総ページ数の変化で範囲外を補正する。
  useEffect(() => {
    setPage(1);
  }, [lo, hi]);
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const start = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  const goPage = (next: number) => {
    setPage(next);
    wrapRef.current?.scrollIntoView({ block: "nearest" });
  };
  const resetYears = () => {
    setFromYear(minYear);
    setToYear(maxYear);
  };

  if (outcomes.length === 0) {
    return <div className="empty">該当する戦闘履歴がありません。</div>;
  }

  return (
    <div className="detail-log-wrap" ref={wrapRef}>
      {years.length >= 2 && (
        <div className="log-filter">
          <span className="log-filter-label">表示する年</span>
          <label className="log-filter-field">
            <span className="sr-only">開始年</span>
            <select
              className="select"
              value={fromYear}
              onChange={(e) => setFromYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <span className="log-filter-sep" aria-hidden="true">
            〜
          </span>
          <label className="log-filter-field">
            <span className="sr-only">終了年</span>
            <select
              className="select"
              value={toYear}
              onChange={(e) => setToYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          {isFiltered && (
            <button
              type="button"
              className="btn log-filter-clear"
              onClick={resetYears}
            >
              全期間
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          選択した期間（{lo}年〜{hi}年）の戦闘履歴がありません。
        </div>
      ) : (
        <>
          <ul className="detail-log">
            {paged.map((o, i) => (
              <li
                key={`${o.record.savedAt}-${start + i}-${o.side}`}
                className={"dl-row dl-row--" + o.result}
              >
                <span className={"dl-result dl-result--" + o.result}>
                  {resultLabel(o)}
                </span>
                <div className="dl-main">
                  <div className="dl-meta">
                    {o.card.battleAt ?? o.record.time ?? ""}
                    {o.card.place ? ` · ${o.card.place}` : ""}
                    {o.card.turns ? ` · ${o.card.turns}ターン` : ""}
                  </div>
                  <div className="dl-match">
                    <SideChip
                      side={o.self}
                      currentName={currentName}
                      currentUnit={currentUnit}
                      onSelectWarlord={onSelectWarlord}
                      onSelectUnit={onSelectUnit}
                    />
                    <span className="dl-vs">vs</span>
                    <SideChip
                      side={o.opponent}
                      currentName={currentName}
                      currentUnit={currentUnit}
                      onSelectWarlord={onSelectWarlord}
                      onSelectUnit={onSelectUnit}
                    />
                  </div>
                </div>
                {o.card.url && <LogRowActions url={o.card.url} />}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="pager">
              <button
                type="button"
                className="btn pager-btn"
                onClick={() => goPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft />
                <span>前へ</span>
              </button>
              <span className="pager-info">
                {rangeStart.toLocaleString("ja-JP")}–
                {rangeEnd.toLocaleString("ja-JP")} /{" "}
                {filtered.length.toLocaleString("ja-JP")}件（{page} / {totalPages}
                ）
              </span>
              <button
                type="button"
                className="btn pager-btn"
                onClick={() => goPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                <span>次へ</span>
                <ChevronRight />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export type { OutcomeResult };
