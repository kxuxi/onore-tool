"use client";

import { useEffect, useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import { SearchIcon, FilterIcon, CloseIcon } from "@/components/icons";
import {
  ACTION_LABEL,
  formatElapsed,
  getActionInfo,
  STATUS_ORDER,
  type ActionStatus,
} from "@/lib/action";

interface Props {
  db: WarlordMap;
  onSelectWarlord: (name: string) => void;
}

const STATUS_CLASS: Record<ActionStatus, string> = {
  done: "status done",
  ready: "status ready",
  unknown: "status unknown",
  none: "status none",
};

// 集計・フィルタに表示するステータス（none を除く）。ラベルは ACTION_LABEL から導出。
const STATUS_SUMMARY_ORDER = ["ready", "unknown", "done"] as const;

export function DamageTab({ db, onSelectWarlord }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | ActionStatus>("");
  const [factionFilter, setFactionFilter] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  // 経過時間をリアルタイム表示するため 30 秒ごとに現在時刻を更新。
  // タブが非表示の間はインターバルを止め、再表示時に即時更新して再開する。
  useEffect(() => {
    let id: number | undefined;
    const tick = () => setNow(new Date());
    const start = () => {
      if (id == null) id = window.setInterval(tick, 30000);
    };
    const stop = () => {
      if (id != null) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };
    tick();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const rows = useMemo(() => {
    if (!now) return [];
    const q = nameQuery.trim().toLowerCase();
    return Object.values(db)
      .map((w) => ({ w, info: getActionInfo(w, now) }))
      .filter((r) => r.info.status !== "none")
      .filter((r) => (statusFilter ? r.info.status === statusFilter : true))
      .filter((r) => (factionFilter ? r.w.faction === factionFilter : true))
      .filter((r) => (q ? r.w.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        // 行動可 → 不明 → 行動済みの順。
        // 同ステータス内は経過時間の昇順（短い＝さっき行動可になった人が上）。
        const so = STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status];
        if (so !== 0) return so;
        return (a.info.minutes ?? 0) - (b.info.minutes ?? 0);
      });
  }, [db, now, statusFilter, factionFilter, nameQuery]);

  // 国の選択肢（行動時刻を持つ武将の勢力名）
  const factionOptions = useMemo(() => {
    return Array.from(
      new Set(
        Object.values(db)
          .filter((w) => w.lastActionAt)
          .map((w) => w.faction?.trim())
          .filter((v): v is string => !!v)
      )
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [db]);

  const counts = useMemo(() => {
    const c = { done: 0, ready: 0, unknown: 0 };
    for (const { info } of rows) {
      if (info.status === "done") c.done++;
      else if (info.status === "ready") c.ready++;
      else if (info.status === "unknown") c.unknown++;
    }
    return c;
  }, [rows]);

  // 検索ボックスとは別にトグルするドロップダウン系の絞り込み。
  const hasDropdownFilter = !!(statusFilter || factionFilter);
  const hasFilter = !!(nameQuery || statusFilter || factionFilter);
  const clearFilters = () => {
    setNameQuery("");
    setStatusFilter("");
    setFactionFilter("");
  };

  return (
    <section className="panel">
      <h2>被弾表（行動状況）</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        各武将の行動時刻からの経過時間で行動状況を判定します。
        40分以内={ACTION_LABEL.done} / 40分〜1時間20分={ACTION_LABEL.ready} /
        1時間20分以上={ACTION_LABEL.unknown}。
      </p>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        最終更新{" "}
        {now ? now.toLocaleTimeString("ja-JP", { hour12: false }) : "--:--:--"}
        （30秒ごとに自動更新）
      </p>

      <div className="stat-grid">
        {STATUS_SUMMARY_ORDER.map((s) => (
          <div className="stat" key={s}>
            <div className="label">{ACTION_LABEL[s]}</div>
            <div className="value">{counts[s].toLocaleString("ja-JP")}</div>
          </div>
        ))}
      </div>

      <details className="badge-legend">
        <summary>固定バッジの見方</summary>
        <ul className="badge-legend-list">
          <li>
            <span className="status no-rest no-rest--loose">末尾固定</span>
            <span className="muted">
              行動時刻の「分」の1の位が2戦以上そろっている（休養を挟まず連続行動の疑い）。
            </span>
          </li>
          <li>
            <span className="status no-rest no-rest--strict">休養なし</span>
            <span className="muted">
              直近2戦以上がちょうど60分間隔で並んでいる。
            </span>
          </li>
          <li>
            <span className="status no-rest no-rest--evolved">固定分</span>
            <span className="muted">
              末尾固定が5戦以上連続。固定行動の可能性が高い。
            </span>
          </li>
        </ul>
      </details>

      <div className="search-row">
        <div className="search-box">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            type="search"
            className="text-input search-input"
            placeholder="武将名で絞り込み"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
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
            <span>ステータス</span>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "" | ActionStatus)
              }
            >
              <option value="">すべて</option>
              {STATUS_SUMMARY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ACTION_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>国</span>
            <select
              className="select"
              value={factionFilter}
              onChange={(e) => setFactionFilter(e.target.value)}
            >
              <option value="">すべて</option>
              {factionOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">
            <p className="empty-title">表示できる行動データがありません</p>
            <p className="empty-hint">
              「戦闘履歴」タブで戦績を貼り付けて登録すると、各武将の行動時刻から
              行動状況を判定してここに表示します。
              絞り込みを設定している場合はステータス・国の条件を見直してください。
            </p>
          </div>
        ) : (
          <table className="table-card">
            <thead>
              <tr>
                <th>状況</th>
                <th>国</th>
                <th>武将名</th>
                <th>タイプ</th>
                <th>兵科</th>
                <th>兵種</th>
                <th>行動時刻</th>
                <th>経過</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ w, info }) => (
                <tr key={w.name}>
                  <td className="cell-block" data-label="状況">
                    <span className={STATUS_CLASS[info.status]}>
                      {ACTION_LABEL[info.status]}
                    </span>
                    {info.noRestLabel && (
                      <span
                        className={
                          info.noRestLabel === "固定分"
                            ? "status no-rest no-rest--evolved"
                            : info.noRestLabel === "休養なし"
                              ? "status no-rest no-rest--strict"
                              : "status no-rest no-rest--loose"
                        }
                        title={`末尾固定 ${info.noRestStreak}戦連続 / 休養なし ${info.strictStreak}戦連続`}
                      >
                        {info.noRestLabel}
                      </span>
                    )}
                  </td>
                  <td data-label="国">
                    {w.faction ? (
                      <span className="tag faction">{w.faction}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="cell-title">
                    <button
                      type="button"
                      className="link-like"
                      onClick={() => onSelectWarlord(w.name)}
                      title={`${w.name} の戦績を見る`}
                    >
                      {w.name}
                    </button>
                  </td>
                  <td data-label="タイプ">
                    <span className="tag type">{w.type}</span>
                  </td>
                  <td data-label="兵科">
                    <span className="tag branch">{w.branch}</span>
                  </td>
                  <td data-label="兵種">
                    {w.unit ? (
                      <span className="tag unit">{w.unit}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="muted" data-label="行動時刻" style={{ fontSize: 12 }}>
                    {w.lastActionAt ?? "-"}
                  </td>
                  <td className="muted" data-label="経過" style={{ fontSize: 12 }}>
                    {formatElapsed(info.minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
