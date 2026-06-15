"use client";

import { useEffect, useRef, useState } from "react";
import {
  DAY_LABELS,
  type BranchStat,
  type FactionStint,
  type HeatCell,
  type MatchupRanking as MatchupRankingData,
  type OpponentStat,
  type WinHeatmap,
} from "@/lib/stats";
import { getWarlordNote, setWarlordNote } from "@/lib/warlordNotes";

/** 勝率を百分率の文字列にする（決着が無ければ "—"）。 */
function pctLabel(rate: number, decided: number): string {
  return decided > 0 ? `${Math.round(rate * 100)}%` : "—";
}

/** 対戦相手名のリンクボタン（クリックでその武将ページへ）。 */
function OpponentName({
  name,
  onSelect,
}: {
  name: string;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      className="link-like"
      onClick={() => onSelect(name)}
      title={`${name} の戦績を見る`}
    >
      {name}
    </button>
  );
}

/* ---------- 相性ランキング ---------- */

function RankRow({
  rank,
  stat,
  onSelectWarlord,
}: {
  rank: number;
  stat: OpponentStat;
  onSelectWarlord: (name: string) => void;
}) {
  return (
    <li className="rank-row">
      <span className="rank-no">{rank}</span>
      <span className="rank-name">
        <OpponentName name={stat.name} onSelect={onSelectWarlord} />
        {stat.faction && <span className="rank-faction">{stat.faction}</span>}
      </span>
      <span className="rank-rate">{pctLabel(stat.winRate, stat.decided)}</span>
      <span className="rank-record">
        {stat.wins}勝{stat.losses}敗
      </span>
    </li>
  );
}

export function MatchupRanking({
  ranking,
  onSelectWarlord,
}: {
  ranking: MatchupRankingData;
  onSelectWarlord: (name: string) => void;
}) {
  if (ranking.best.length === 0) return null;
  return (
    <div className="detail-section">
      <h3>相性ランキング</h3>
      <div className="rank-cols">
        <div className="rank-col">
          <h4 className="rank-head rank-head--good">相性の良い相手</h4>
          <ol className="rank-list">
            {ranking.best.map((s, i) => (
              <RankRow
                key={s.name}
                rank={i + 1}
                stat={s}
                onSelectWarlord={onSelectWarlord}
              />
            ))}
          </ol>
        </div>
        {ranking.worst.length > 0 && (
          <div className="rank-col">
            <h4 className="rank-head rank-head--bad">苦手な相手</h4>
            <ol className="rank-list">
              {ranking.worst.map((s, i) => (
                <RankRow
                  key={s.name}
                  rank={i + 1}
                  stat={s}
                  onSelectWarlord={onSelectWarlord}
                />
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 兵科別の勝率 ---------- */

export function BranchWinRates({ branches }: { branches: BranchStat[] }) {
  if (branches.length === 0) return null;
  return (
    <div className="detail-section">
      <h3>兵科別の勝率</h3>
      <ul className="branch-list">
        {branches.map((b) => {
          const winPct = b.decided > 0 ? (b.winRate * 100).toFixed(0) : "0";
          return (
            <li key={b.branch} className="branch-row">
              <span className="branch-name">{b.branch}</span>
              <span
                className="branch-bar"
                role="progressbar"
                aria-valuenow={b.decided > 0 ? Math.round(b.winRate * 100) : 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${b.branch} の勝率 ${
                  b.decided > 0 ? Math.round(b.winRate * 100) : 0
                }%`}
              >
                <span
                  className="branch-bar-fill"
                  style={{ width: `${b.decided > 0 ? b.winRate * 100 : 0}%` }}
                />
              </span>
              <span className="branch-rate">
                {pctLabel(b.winRate, b.decided)}
              </span>
              <span className="branch-record">
                {b.wins}勝{b.losses}敗
                <span className="muted">（{b.battles}戦）</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- 時間帯・曜日別の勝率ヒートマップ ---------- */

/** セルの背景色を勝率で決める（GitHub 風の緑グラデーション）。 */
function heatStyle(cell: HeatCell): React.CSSProperties {
  if (cell.decided > 0) {
    const alpha = 0.18 + 0.82 * cell.winRate;
    return { background: `rgba(29, 158, 117, ${alpha.toFixed(3)})` };
  }
  if (cell.battles > 0) {
    // 戦闘はあるが勝敗未確定（撤退・引分のみ）
    return { background: "rgba(255, 255, 255, 0.06)" };
  }
  return {};
}

function heatTitle(
  day: string,
  startHour: string,
  cell: HeatCell
): string {
  const range = `${day} ${startHour}時台`;
  if (cell.battles === 0) return `${range}・戦闘なし`;
  return `${range}・${cell.wins}勝${cell.losses}敗（勝率 ${pctLabel(
    cell.winRate,
    cell.decided
  )} / ${cell.battles}戦）`;
}

export function WinHeatmapSection({ heatmap }: { heatmap: WinHeatmap }) {
  if (heatmap.dated === 0) return null;
  return (
    <div className="detail-section">
      <h3>時間帯・曜日別の勝率</h3>
      <div className="heatmap-wrap">
        <div className="heatmap">
          <div className="heat-corner" />
          {heatmap.bucketLabels.map((label) => (
            <div key={label} className="heat-col-label">
              {label}
            </div>
          ))}
          {heatmap.cells.map((row, day) => (
            <div key={day} className="heat-row" role="row">
              <div className="heat-row-label">{DAY_LABELS[day]}</div>
              {row.map((cell, b) => (
                <div
                  key={b}
                  className="heat-cell"
                  style={heatStyle(cell)}
                  title={heatTitle(
                    DAY_LABELS[day],
                    heatmap.bucketLabels[b],
                    cell
                  )}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="heat-legend">
          <span className="muted">低</span>
          <span className="heat-legend-scale" />
          <span className="muted">高（勝率）</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- 所属国の遍歴 ---------- */

function stintYears(s: FactionStint): string {
  if (s.startYear === 0 && s.endYear === 0) return "在籍年不明";
  if (s.startYear === s.endYear) return `${s.startYear}年`;
  return `${s.startYear}〜${s.endYear}年`;
}

export function FactionHistory({ stints }: { stints: FactionStint[] }) {
  if (stints.length === 0) return null;
  const returned = stints.filter((s) => s.returning);
  return (
    <div className="detail-section">
      <h3>所属国の遍歴</h3>
      <ol className="faction-timeline">
        {stints.map((s, i) => (
          <li key={`${s.faction}-${i}`} className="faction-stint">
            <span className="faction-dot" />
            <span className="faction-stint-body">
              <span className="faction-stint-name">{s.faction}</span>
              {s.returning && (
                <span className="faction-return-badge">出戻り</span>
              )}
              <span className="faction-stint-years">{stintYears(s)}</span>
              <span className="muted faction-stint-battles">
                {s.battles}戦
              </span>
            </span>
          </li>
        ))}
      </ol>
      {returned.length > 0 && (
        <p className="faction-return-note">
          ※「出戻り」は一度離れた国へ戻った在籍を表します。
        </p>
      )}
    </div>
  );
}

/* ---------- 一言コメント ---------- */

export function WarlordComment({ name }: { name: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  // 武将が切り替わったら保存済みコメントを読み込む。
  useEffect(() => {
    setText(getWarlordNote(name));
    setSaved(false);
  }, [name]);

  const savedTimer = useRef<number | null>(null);
  const persist = (value: string) => {
    setWarlordNote(name, value);
    setSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1500);
  };
  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  return (
    <div className="detail-section">
      <h3 className="comment-head">
        一言コメント
        {saved && <span className="comment-saved">保存しました</span>}
      </h3>
      <textarea
        className="comment-box"
        value={text}
        placeholder="この武将についてのメモ（強さ・クセ・対策など）を自由に記録できます。"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => persist(text)}
      />
    </div>
  );
}
