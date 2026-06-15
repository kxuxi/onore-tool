"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StatSummary } from "@/lib/stats";
import { ChevronLeft, ShareIcon, CheckIcon } from "@/components/icons";
import { copyText } from "@/lib/clipboard";

interface HeaderProps {
  kind: string;
  title: string;
  tags?: ReactNode;
  onBack: () => void;
}

/** 現在のページURL（ディープリンク）をクリップボードへコピーする共有ボタン。 */
function ShareLinkButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      type="button"
      className={"btn detail-share" + (copied ? " copied" : "")}
      onClick={share}
      aria-label={
        copied ? "リンクをコピーしました" : "このページのリンクをコピー"
      }
      title={copied ? "コピーしました" : "リンクをコピー"}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      <span>{copied ? "コピー済み" : "共有"}</span>
    </button>
  );
}

export function DetailHeader({ kind, title, tags, onBack }: HeaderProps) {
  // 詳細ページへ遷移したら見出しへフォーカスを移す（キーボード／スクリーンリーダー対応）。
  // kind・title が変わるたびに発火し、武将→兵種などの遷移や戻る操作にも追従する。
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [kind, title]);

  return (
    <div className="detail-head">
      <button type="button" className="btn detail-back" onClick={onBack}>
        <ChevronLeft />
        <span>戻る</span>
      </button>
      <div className="detail-title">
        <span className="detail-kind">{kind}</span>
        <h2 ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        {tags && <div className="detail-tags">{tags}</div>}
      </div>
      <ShareLinkButton />
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
        <div className="value">{summary.battles.toLocaleString("ja-JP")}</div>
      </div>
      <div className="stat">
        <div className="label">勝利</div>
        <div className="value stat-win-text">
          {summary.wins.toLocaleString("ja-JP")}
        </div>
      </div>
      <div className="stat">
        <div className="label">敗北</div>
        <div className="value stat-loss-text">
          {summary.losses.toLocaleString("ja-JP")}
        </div>
      </div>
      <div className="stat">
        <div className="label">勝率</div>
        <div className="value">{rate}</div>
      </div>
      {summary.others > 0 && (
        <div className="stat">
          <div className="label">撤退・引分</div>
          <div className="value stat-other-text">
            {summary.others.toLocaleString("ja-JP")}
          </div>
        </div>
      )}
    </div>
  );
}
