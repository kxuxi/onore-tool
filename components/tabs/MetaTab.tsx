"use client";

import { useMemo, useState } from "react";
import type { BattleRecord } from "@/lib/types";
import {
  metaOverview,
  formatWinRate,
  META_PERIODS,
  type MetaTier,
} from "@/lib/stats";
import { AlertTriangleIcon } from "@/components/icons";

interface Props {
  log: BattleRecord[];
  onSelectUnit: (name: string) => void;
}

/** 集計期間のプリセット（ゲーム内の年で区切る）。相性マトリックスと共通。 */
type PeriodKey = (typeof META_PERIODS)[number]["key"];

/** 採用率ランキングに表示する上位件数。 */
const TOP_N = 10;
/** トレンドを「横ばい」とみなす勝率差のしきい値（ポイント）。 */
const TREND_FLAT = 0.02;

/** パーセント表示（整数）。 */
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** ティアを CSS クラス用の安全な接尾辞に変換する（"S+" → "splus"）。 */
function tierClass(tier: MetaTier): string {
  return tier.toLowerCase().replace("+", "plus");
}

/** トレンド値（勝率差 -1..1）を表示用ラベル＋方向に変換する。 */
function trendInfo(
  trend: number | null
): { dir: "up" | "down" | "flat" | "none"; label: string } {
  if (trend == null) return { dir: "none", label: "—" };
  const pt = Math.round(trend * 100);
  if (trend > TREND_FLAT) return { dir: "up", label: `▲ +${pt}pt` };
  if (trend < -TREND_FLAT) return { dir: "down", label: `▼ ${pt}pt` };
  return { dir: "flat", label: "→ 横ばい" };
}

/**
 * 環境ダッシュボード。期間内の兵種採用率・勝率・強度ティア・トレンド、特性別勝率、
 * 環境警告をまとめて表示する。兵種名クリックで兵種詳細へ遷移する。
 */
export function MetaTab({ log, onSelectUnit }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("all");

  const range = useMemo(
    () => META_PERIODS.find((p) => p.key === period) ?? null,
    [period]
  );

  const { totalBattles, units, traits, warnings } = useMemo(
    () => metaOverview(log, range ?? undefined),
    [log, range]
  );

  // 採用率上位（少なくとも 1 回は登場した兵種のみ）。
  const topUnits = useMemo(
    () => units.filter((u) => u.appearances > 0).slice(0, TOP_N),
    [units]
  );

  // 特性は登場のあるもののみ表示し、採用率バーは最大値を基準にする。
  const shownTraits = useMemo(
    () => traits.filter((t) => t.appearances > 0),
    [traits]
  );
  const maxTraitPick = useMemo(
    () => Math.max(0, ...shownTraits.map((t) => t.pickRate)),
    [shownTraits]
  );

  return (
    <section className="panel">
      <h2>環境ダッシュボード</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        期間内に登場した兵種の採用率・勝率・強度（S+〜C）とトレンド、特性別の勝率、
        環境警告をまとめて表示します。兵種名をクリックすると詳細を確認できます。
      </p>

      <div className="tmx-periods" role="tablist" aria-label="集計期間">
        {META_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={period === p.key}
            className={"tmx-period" + (period === p.key ? " active" : "")}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {totalBattles === 0 ? (
        <p className="muted">この期間の対戦データがありません。</p>
      ) : (
        <>
          {warnings.length > 0 && (
            <div className="meta-warnings" role="status">
              {warnings.map((w) => (
                <div
                  key={w.unit + w.level}
                  className={"meta-warning " + w.level}
                >
                  <AlertTriangleIcon />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="meta-block">
            <h3 className="meta-h3">
              採用率 TOP {TOP_N}
              <span className="meta-h3-sub">全{totalBattles}戦</span>
            </h3>
            <ol className="meta-units">
              {topUnits.map((u, i) => {
                const tr = trendInfo(u.trend);
                return (
                  <li className="meta-row" key={u.unit}>
                    <span className="meta-rank">{i + 1}</span>
                    <div className="meta-main">
                      <div className="meta-head">
                        <button
                          type="button"
                          className="link-like meta-name"
                          onClick={() => onSelectUnit(u.unit)}
                        >
                          {u.unit}
                        </button>
                        {u.branch && (
                          <span className="tag branch">{u.branch}</span>
                        )}
                        {u.tier && (
                          <span
                            className={`meta-tier tier-${tierClass(u.tier)}`}
                          >
                            {u.tier}
                          </span>
                        )}
                        <span className={`meta-trend trend-${tr.dir}`}>
                          {tr.label}
                        </span>
                      </div>
                      <div className="meta-metrics">
                        <span className="meta-metric">
                          採用 <strong>{pct(u.pickRate)}</strong>
                        </span>
                        <span className="meta-metric">
                          勝率{" "}
                          <strong>
                            {formatWinRate(u.winRate, u.decided)}
                          </strong>{" "}
                          <span className="meta-sub">
                            （{u.wins}-{u.losses}）
                          </span>
                        </span>
                      </div>
                      <div
                        className="meta-bar"
                        role="img"
                        aria-label={`勝率 ${formatWinRate(
                          u.winRate,
                          u.decided
                        )}`}
                      >
                        <span
                          className="meta-bar-fill"
                          style={{ width: `${Math.round(u.winRate * 100)}%` }}
                        />
                        <span className="meta-bar-mid" aria-hidden="true" />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="meta-block">
            <h3 className="meta-h3">特性別の勝率</h3>
            <ul className="meta-traits">
              {shownTraits.map((t) => (
                <li className="meta-trait-row" key={t.trait}>
                  <span className="meta-trait-name">{t.trait}</span>
                  <span className="meta-trait-pick">採用 {pct(t.pickRate)}</span>
                  <div className="meta-trait-bar">
                    <span
                      className="meta-trait-bar-fill"
                      style={{
                        width:
                          maxTraitPick > 0
                            ? `${Math.round((t.pickRate / maxTraitPick) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="meta-trait-rate">
                    {formatWinRate(t.winRate, t.decided)}
                    <span className="meta-sub">
                      {" "}
                      （{t.wins}-{t.losses}）
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
