"use client";

import { formatWinRate } from "@/lib/stats";
import { Section } from "@/components/detail/Section";
import type {
  OpponentUnitStat,
  UnitMatchupRanking as UnitMatchupRankingData,
  UsageTrendPoint,
  UserWinRate,
} from "@/lib/stats";

/* ---------- 相性の良い／苦手な敵兵種 ---------- */

function UnitRankRow({
  rank,
  stat,
  onSelectUnit,
}: {
  rank: number;
  stat: OpponentUnitStat;
  onSelectUnit: (name: string) => void;
}) {
  return (
    <li className="rank-row">
      <span className="rank-no">{rank}</span>
      <span className="rank-name">
        <button
          type="button"
          className="link-like"
          onClick={() => onSelectUnit(stat.unit)}
          title={`${stat.unit} の戦績を見る`}
        >
          {stat.unit}
        </button>
      </span>
      <span className="rank-rate">{formatWinRate(stat.winRate, stat.decided)}</span>
      <span className="rank-record">
        {stat.wins}勝{stat.losses}敗
      </span>
    </li>
  );
}

export function UnitMatchupRanking({
  ranking,
  onSelectUnit,
}: {
  ranking: UnitMatchupRankingData;
  onSelectUnit: (name: string) => void;
}) {
  if (ranking.best.length === 0) return null;
  return (
    <Section title="敵兵種との相性" mobileCollapsed>
      <div className="rank-cols">
        <div className="rank-col">
          <h4 className="rank-head rank-head--good">相性の良い敵兵種</h4>
          <ol className="rank-list">
            {ranking.best.map((s, i) => (
              <UnitRankRow
                key={s.unit}
                rank={i + 1}
                stat={s}
                onSelectUnit={onSelectUnit}
              />
            ))}
          </ol>
        </div>
        {ranking.worst.length > 0 && (
          <div className="rank-col">
            <h4 className="rank-head rank-head--bad">苦手な敵兵種</h4>
            <ol className="rank-list">
              {ranking.worst.map((s, i) => (
                <UnitRankRow
                  key={s.unit}
                  rank={i + 1}
                  stat={s}
                  onSelectUnit={onSelectUnit}
                />
              ))}
            </ol>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- 武将別の勝率比較 ---------- */

export function UserWinRateList({
  users,
  onSelectWarlord,
}: {
  users: UserWinRate[];
  onSelectWarlord: (name: string) => void;
}) {
  if (users.length === 0) return null;
  const top = users.slice(0, 5);
  return (
    <Section title="武将別の勝率" mobileCollapsed>
      <ul className="user-winrate-list">
        {top.map((u) => (
          <li key={u.name} className="user-winrate-row">
            <div className="user-winrate-head">
              <button
                type="button"
                className="user-winrate-name link-like"
                onClick={() => onSelectWarlord(u.name)}
                title={`${u.name} の戦績を見る`}
              >
                {u.name}
              </button>
              <span className="user-winrate-meta">
                <span className="user-winrate-rate">
                  {formatWinRate(u.winRate, u.decided)}
                </span>
                <span className="muted">
                  {u.wins}勝{u.losses}敗（{u.battles}戦）
                </span>
              </span>
            </div>
            <span
              className="branch-bar"
              role="progressbar"
              aria-valuenow={u.decided > 0 ? Math.round(u.winRate * 100) : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${u.name} の勝率 ${
                u.decided > 0 ? Math.round(u.winRate * 100) : 0
              }%`}
            >
              <span
                className="branch-bar-fill"
                style={{ width: `${u.decided > 0 ? u.winRate * 100 : 0}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- 時期別の使用率推移 ---------- */

export function UsageTrend({ points }: { points: UsageTrendPoint[] }) {
  // 使用実績が 1 件も無い、または期間が 1 点しか無い場合は推移にならないため非表示。
  const meaningful = points.filter((p) => p.unitBattles > 0);
  if (meaningful.length === 0 || points.length < 2) return null;
  const maxRate = Math.max(...points.map((p) => p.rate), 0.0001);
  return (
    <Section title="使用率の推移（年別）" mobileCollapsed>
      <p className="trend-note muted">
        各年の全戦闘のうち、この兵種が登場した割合。
      </p>
      <div className="trend-chart">
        {points.map((p) => {
          const h = Math.round((p.rate / maxRate) * 100);
          return (
            <div
              key={p.year}
              className="trend-col"
              title={`${p.year}年：使用率 ${Math.round(p.rate * 100)}%（${
                p.unitBattles
              }/${p.totalBattles}戦）`}
            >
              <div className="trend-bar-track">
                <div
                  className="trend-bar-fill"
                  style={{ height: `${Math.max(h, p.unitBattles > 0 ? 3 : 0)}%` }}
                />
              </div>
              <div className="trend-pct">{Math.round(p.rate * 100)}%</div>
              <div className="trend-year">{p.year}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
