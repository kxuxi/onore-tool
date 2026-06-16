"use client";

import { useMemo, useState } from "react";
import type { BattleRecord } from "@/lib/types";
import { FilterIcon, CloseIcon } from "@/components/icons";
import { SearchBox } from "@/components/SearchBox";
import {
  warlordRanking,
  rankMetricValue,
  isAttackMetric,
  type RankMetric,
} from "@/lib/stats";

interface Props {
  log: BattleRecord[];
  onSelectWarlord: (name: string) => void;
}

/** 最低出兵数の選択肢。ノイズを除くためのしきい値（指標側の出撃数に適用）。 */
const MIN_SORTIE_OPTIONS = [1, 5, 10, 20, 30];

const METRIC_OPTIONS: {
  key: RankMetric;
  label: string;
  kind: "count" | "swi";
}[] = [
  { key: "attackWins", label: "出兵勝利数", kind: "count" },
  { key: "defenseWins", label: "守備勝利数", kind: "count" },
  { key: "attackSwi", label: "SWI（攻撃）", kind: "swi" },
  { key: "defenseSwi", label: "SWI（守備）", kind: "swi" },
];

export function SwiTab({ log, onSelectWarlord }: Props) {
  const [metric, setMetric] = useState<RankMetric>("attackWins");
  const [minSorties, setMinSorties] = useState(10);
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const ranking = useMemo(() => warlordRanking(log), [log]);

  const metricKind =
    METRIC_OPTIONS.find((m) => m.key === metric)?.kind ?? "count";
  const metricLabel =
    METRIC_OPTIONS.find((m) => m.key === metric)?.label ?? "";
  const attackSide = isAttackMetric(metric);

  // 兵科の選択肢（ランキング対象から収集）。
  const branchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          ranking
            .map((r) => r.branch?.trim())
            .filter((v): v is string => !!v)
        )
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [ranking]
  );

  // 絞り込み・並べ替えを適用した表示用リスト。
  const view = useMemo(() => {
    const q = query.trim();
    const activeSorties = (s: (typeof ranking)[number]) =>
      attackSide ? s.attackSorties : s.defenseSorties;
    const filtered = ranking.filter(
      (r) =>
        activeSorties(r) >= minSorties &&
        (branch ? r.branch === branch : true) &&
        (q ? r.name.includes(q) : true)
    );
    return [...filtered].sort((a, b) => {
      const va = rankMetricValue(a, metric);
      const vb = rankMetricValue(b, metric);
      if (vb !== va) return vb - va;
      // 同値はその側の出撃数で安定させる。
      return activeSorties(b) - activeSorties(a);
    });
  }, [ranking, query, branch, minSorties, metric, attackSide]);

  // バー幅の基準となる最大値（表示対象の最大・ループ外で計算）。
  const maxValue =
    view.reduce((m, r) => Math.max(m, rankMetricValue(r, metric)), 0) || 1;

  const formatValue = (v: number) =>
    metricKind === "swi" ? v.toFixed(2) : v.toLocaleString("ja-JP");

  // 検索ボックスとは別にトグルするドロップダウン系の絞り込み。
  const hasDropdownFilter = !!branch;
  const hasFilter = !!(query || branch);
  const clearFilters = () => {
    setQuery("");
    setBranch("");
  };

  return (
    <section className="panel">
      <h2>武将ランキング</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        出兵勝利数・守備勝利数・SWI（攻撃／守備）で武将を順位付けします。SWIは1回の出撃で
        連続撃破した枚数（枚抜き）に重みを掛けて評価した指標です。
      </p>

      <details className="swi-formula">
        <summary>SWIの算出式と重みの詳細</summary>
        <p className="muted">
          SWI = Σ(枚抜き × 重み) ÷ 総出兵数。1回の出撃（同一時刻の連戦）で1戦目から
          連勝した数を「枚抜き」とし、枚数ごとの重みを掛けた実効値を合算して総出兵数で割ります。
          SWI（守備）は守備側を1戦目から連続で守り切った枚数として同じ重みで評価します
          （守備は単発になりやすく値は小さめになります）。
        </p>
        <table className="swi-weight-table">
          <thead>
            <tr>
              <th>枚抜き</th>
              <th>乗数</th>
              <th>実効値</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2枚</td>
              <td>×1.0</td>
              <td>2.0</td>
            </tr>
            <tr>
              <td>3枚</td>
              <td>×1.2</td>
              <td>3.6</td>
            </tr>
            <tr>
              <td>4枚</td>
              <td>×1.5</td>
              <td>6.0</td>
            </tr>
            <tr>
              <td>5枚</td>
              <td>×2.0</td>
              <td>10.0</td>
            </tr>
            <tr>
              <td>6枚</td>
              <td>×2.5</td>
              <td>15.0</td>
            </tr>
          </tbody>
        </table>
      </details>

      <div className="search-row">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="武将名で検索"
        />
        <button
          type="button"
          className={
            "btn filter-toggle" +
            (showFilter || hasDropdownFilter ? " active" : "")
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
              onChange={(e) => setMetric(e.target.value as RankMetric)}
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>{attackSide ? "最低出兵数" : "最低守備数"}</span>
            <select
              className="select"
              value={minSorties}
              onChange={(e) => setMinSorties(Number(e.target.value))}
            >
              {MIN_SORTIE_OPTIONS.map((v) => (
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
          <p className="empty-title">条件を満たす武将がいません</p>
          <p className="empty-hint">
            「戦闘履歴」タブで戦績を登録すると、出撃データからランキングを算出します。
            すでに登録済みの場合は、指標・検索語・兵科・最低出兵数の条件を見直してください。
          </p>
        </div>
      ) : (
        <ol className="swi-list">
          {view.map((r, i) => {
            const value = rankMetricValue(r, metric);
            return (
              <li key={r.name} className="swi-row">
                <span className="swi-rank">{i + 1}</span>
                <div className="swi-main">
                  <div className="swi-head">
                    <button
                      type="button"
                      className="swi-name link-like"
                      onClick={() => onSelectWarlord(r.name)}
                      title={`${r.name} の戦績を見る`}
                    >
                      {r.name}
                    </button>
                    <span className="swi-value">{formatValue(value)}</span>
                  </div>
                  <span
                    className="swi-bar"
                    role="progressbar"
                    aria-valuenow={Math.round((value / maxValue) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${r.name} の${metricLabel} ${formatValue(
                      value
                    )}`}
                  >
                    <span
                      className="swi-bar-fill"
                      style={{ width: `${(value / maxValue) * 100}%` }}
                    />
                  </span>
                  <div className="swi-meta muted">
                    <span className={attackSide ? "rank-side-active" : ""}>
                      攻 出撃{r.attackSorties.toLocaleString("ja-JP")}・勝
                      {r.attackWins.toLocaleString("ja-JP")}・SWI
                      {r.attackSwi.toFixed(2)}
                    </span>
                    <span className="rank-sep">／</span>
                    <span className={!attackSide ? "rank-side-active" : ""}>
                      守 出撃{r.defenseSorties.toLocaleString("ja-JP")}・勝
                      {r.defenseWins.toLocaleString("ja-JP")}・SWI
                      {r.defenseSwi.toFixed(2)}
                    </span>
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
