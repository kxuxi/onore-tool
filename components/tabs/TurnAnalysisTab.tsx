"use client";

import { useMemo, useState } from "react";
import type { BattleRecord } from "@/lib/types";
import { FilterIcon, CloseIcon } from "@/components/icons";
import { SearchBox } from "@/components/SearchBox";
import { turnEfficiency, type TurnEfficiencyStat } from "@/lib/stats";

interface Props {
  log: BattleRecord[];
  onSelectUnit: (name: string) => void;
}

/** ノイズを除くための最低出撃数（指標に対応する母数に適用）。 */
const MIN_BATTLE_OPTIONS = [1, 5, 10, 20, 30];

/** 並べ替えに使う指標。kind は値の表示形式、asc は「小さいほど良い」を表す。 */
type TurnMetric = "avgWinTurns" | "fastWins" | "avgLossTurns" | "avgTurns";

const METRIC_OPTIONS: {
  key: TurnMetric;
  label: string;
  kind: "turns" | "count";
  /** true なら値が小さいほど上位（速攻ほど良い）。 */
  asc: boolean;
}[] = [
  { key: "avgWinTurns", label: "速攻力（勝利までの平均ターン）", kind: "turns", asc: true },
  { key: "fastWins", label: "速攻数（3ターン以内の勝利）", kind: "count", asc: false },
  { key: "avgLossTurns", label: "粘り（敗北までの平均ターン）", kind: "turns", asc: false },
  { key: "avgTurns", label: "平均ターン（全戦闘）", kind: "turns", asc: true },
];

function metricValue(s: TurnEfficiencyStat, metric: TurnMetric): number {
  return s[metric];
}

/** 指標ごとに「しきい値を当てる母数」を返す（勝率系は勝利数 / 粘りは敗北数）。 */
function activeCount(s: TurnEfficiencyStat, metric: TurnMetric): number {
  if (metric === "avgWinTurns" || metric === "fastWins") return s.wins;
  if (metric === "avgLossTurns") return s.losses;
  return s.battles;
}

/**
 * ターン効率（戦闘効率）ランキング。決着までのターン数を兵種ごとに集計し、
 * 速攻力・速攻数・粘りなどの観点で並べ替える。ターン数が判明した戦闘のみが母数。
 */
export function TurnAnalysisTab({ log, onSelectUnit }: Props) {
  const [metric, setMetric] = useState<TurnMetric>("avgWinTurns");
  const [minBattles, setMinBattles] = useState(5);
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const stats = useMemo(() => turnEfficiency(log), [log]);

  const metricDef = METRIC_OPTIONS.find((m) => m.key === metric)!;

  // 兵科の選択肢（集計対象から収集）。
  const branchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          stats.map((s) => s.branch?.trim()).filter((v): v is string => !!v)
        )
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [stats]
  );

  // 絞り込み・並べ替えを適用した表示用リスト。
  const view = useMemo(() => {
    const q = query.trim();
    const filtered = stats.filter(
      (s) =>
        activeCount(s, metric) >= minBattles &&
        (branch ? s.branch === branch : true) &&
        (q ? s.unit.includes(q) : true)
    );
    return [...filtered].sort((a, b) => {
      const va = metricValue(a, metric);
      const vb = metricValue(b, metric);
      if (vb !== va) return metricDef.asc ? va - vb : vb - va;
      // 同値は母数の多い順で安定させる。
      return activeCount(b, metric) - activeCount(a, metric);
    });
  }, [stats, query, branch, minBattles, metric, metricDef.asc]);

  // バー幅の基準。昇順（小さいほど良い）指標は最小値を基準に反転させる。
  const values = view.map((s) => metricValue(s, metric));
  const maxValue = values.reduce((m, v) => Math.max(m, v), 0) || 1;
  const minValue = values.reduce((m, v) => Math.min(m, v), Infinity);

  const barRatio = (v: number): number => {
    if (metricDef.asc) {
      // 速攻ほどバーを長く（最速=100%）。
      if (v <= 0) return 0;
      return Math.min(1, (Number.isFinite(minValue) ? minValue : v) / v);
    }
    return Math.min(1, v / maxValue);
  };

  const formatValue = (v: number): string => {
    if (metricDef.kind === "count") return `${v.toLocaleString("ja-JP")}回`;
    if (v <= 0) return "—";
    return `${v.toFixed(1)}ターン`;
  };

  const hasDropdownFilter = !!branch || metric !== "avgWinTurns" || minBattles !== 5;
  const hasFilter = !!(query || branch);
  const clearFilters = () => {
    setQuery("");
    setBranch("");
  };

  return (
    <section className="panel">
      <h2>ターン効率</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {metric === "avgWinTurns"
          ? "速攻力は、勝利した戦闘の平均ターン数です。少ないほど短いターンで決着＝速攻型です。"
          : metric === "fastWins"
            ? "速攻数は、3ターン以内に勝利した回数です。瞬間火力の高さを表します。"
            : metric === "avgLossTurns"
              ? "粘りは、敗北した戦闘の平均ターン数です。多いほど長く持ちこたえています。"
              : "平均ターンは、勝敗を問わない全戦闘の平均ターン数です。少ないほど戦闘が短時間で終わります。"}
      </p>

      <details className="swi-formula">
        <summary>{metricDef.label}の詳細</summary>
        <p className="muted">
          ターン数が記録された戦闘のみを母数とします（撤退などでターン数が無い戦闘は除外）。
          ターン数は戦闘全体の値なので、勝者側は「速く倒した」、敗者側は「長く粘った」と解釈します。
          {metric === "avgWinTurns" &&
            " 速攻力 = 勝利した戦闘のターン数合計 ÷ 勝利数。"}
          {metric === "fastWins" && " 速攻数 = ターン数が3以下で勝利した戦闘数。"}
          {metric === "avgLossTurns" &&
            " 粘り = 敗北した戦闘のターン数合計 ÷ 敗北数。"}
          {metric === "avgTurns" && " 平均ターン = 全戦闘のターン数合計 ÷ 戦闘数。"}
        </p>
      </details>

      <div className="search-row">
        <SearchBox value={query} onChange={setQuery} placeholder="兵種名で検索" />
        <button
          type="button"
          className={
            "btn filter-toggle" + (showFilter || hasDropdownFilter ? " active" : "")
          }
          onClick={() => setShowFilter((v) => !v)}
          aria-expanded={showFilter}
        >
          <FilterIcon />
          <span>フィルター</span>
        </button>
        {hasFilter && (
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
            <span>指標</span>
            <select
              className="select"
              value={metric}
              onChange={(e) => setMetric(e.target.value as TurnMetric)}
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>
              {metric === "avgLossTurns" ? "最低敗北数" : "最低勝利数"}
            </span>
            <select
              className="select"
              value={minBattles}
              onChange={(e) => setMinBattles(Number(e.target.value))}
            >
              {MIN_BATTLE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}回以上
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>兵科</span>
            <select
              className="select"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">すべて</option>
              {branchOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        該当 {view.length.toLocaleString("ja-JP")}件
      </p>

      {view.length === 0 ? (
        <div className="empty">
          <p className="empty-title">条件を満たす兵種がいません</p>
          <p className="empty-hint">
            「戦闘履歴」タブで戦績を登録すると、ターン数のデータから効率を算出します。
            すでに登録済みの場合は、指標・検索語・兵科・最低回数の条件を見直してください。
          </p>
        </div>
      ) : (
        <ol className="swi-list">
          {view.map((s, i) => {
            const value = metricValue(s, metric);
            return (
              <li key={s.unit} className="swi-row">
                <span className="swi-rank">{i + 1}</span>
                <div className="swi-main">
                  <div className="swi-head">
                    <button
                      type="button"
                      className="swi-name link-like"
                      onClick={() => onSelectUnit(s.unit)}
                      title={`${s.unit} の戦績を見る`}
                    >
                      {s.unit}
                    </button>
                    <span className="swi-value">{formatValue(value)}</span>
                  </div>
                  <span
                    className="swi-bar"
                    role="progressbar"
                    aria-valuenow={Math.round(barRatio(value) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${s.unit} の${metricDef.label} ${formatValue(value)}`}
                  >
                    <span
                      className="swi-bar-fill"
                      style={{ width: `${barRatio(value) * 100}%` }}
                    />
                  </span>
                  <div className="swi-meta muted">
                    <span>{s.branch || "兵科不明"}</span>
                    <span aria-hidden> ・ </span>
                    <span>
                      {s.wins.toLocaleString("ja-JP")}勝
                      {s.losses.toLocaleString("ja-JP")}敗
                    </span>
                    {s.fastWins > 0 && (
                      <>
                        <span aria-hidden> ・ </span>
                        <span>速攻{s.fastWins.toLocaleString("ja-JP")}回</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
