"use client";

import type { ReactNode } from "react";
import type { StatSummary } from "@/lib/stats";

function ChevronLeft() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

interface HeaderProps {
  kind: string;
  title: string;
  tags?: ReactNode;
  onBack: () => void;
}

export function DetailHeader({ kind, title, tags, onBack }: HeaderProps) {
  return (
    <div className="detail-head">
      <button type="button" className="btn detail-back" onClick={onBack}>
        <ChevronLeft />
        <span>戻る</span>
      </button>
      <div className="detail-title">
        <span className="detail-kind">{kind}</span>
        <h2>{title}</h2>
        {tags && <div className="detail-tags">{tags}</div>}
      </div>
    </div>
  );
}

export function WinRateBar({ summary }: { summary: StatSummary }) {
  const { wins, losses, decided } = summary;
  const winPct = decided > 0 ? (wins / decided) * 100 : 0;
  const lossPct = decided > 0 ? (losses / decided) * 100 : 0;
  return (
    <div
      className="wr-bar"
      role="img"
      aria-label={`勝率 ${decided > 0 ? Math.round(winPct) : 0}%`}
    >
      <div className="wr-win" style={{ width: `${winPct}%` }} />
      <div className="wr-loss" style={{ width: `${lossPct}%` }} />
    </div>
  );
}

export function StatCards({ summary }: { summary: StatSummary }) {
  const rate =
    summary.decided > 0 ? `${Math.round(summary.winRate * 100)}%` : "—";
  return (
    <div className="stat-grid detail-stats">
      <div className="stat">
        <div className="label">戦闘数</div>
        <div className="value">{summary.battles}</div>
      </div>
      <div className="stat">
        <div className="label">勝利</div>
        <div className="value stat-win-text">{summary.wins}</div>
      </div>
      <div className="stat">
        <div className="label">敗北</div>
        <div className="value stat-loss-text">{summary.losses}</div>
      </div>
      <div className="stat">
        <div className="label">勝率</div>
        <div className="value">{rate}</div>
      </div>
      {summary.others > 0 && (
        <div className="stat">
          <div className="label">撤退・引分</div>
          <div className="value stat-other-text">{summary.others}</div>
        </div>
      )}
    </div>
  );
}
