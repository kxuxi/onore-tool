"use client";

import { useEffect, useMemo, useState } from "react";
import type { UnitType } from "@/lib/types";
import { fetchUnitTypes } from "@/lib/api";
import { UnitEditModal } from "@/components/tabs/UnitEditModal";
import {
  EMPTY_UNIT,
  parseReqStats,
  splitGoodAgainst,
  BASE_STAT_OPTIONS,
} from "@/lib/unitTypeForm";

type SortKey =
  | "name"
  | "category"
  | "goodAgainst"
  | "attack"
  | "defense"
  | "cost"
  | "reqStats"
  | "bonus";

type SortDir = "asc" | "desc";

const COLUMNS: {
  key: SortKey;
  label: string;
  numeric?: boolean;
  filter: "text" | "select" | "tokens";
}[] = [
  { key: "name", label: "兵種", filter: "text" },
  { key: "category", label: "種類", filter: "select" },
  { key: "goodAgainst", label: "得意", filter: "tokens" },
  { key: "attack", label: "攻", numeric: true, filter: "text" },
  { key: "defense", label: "防", numeric: true, filter: "text" },
  { key: "cost", label: "雇用", filter: "text" },
  { key: "reqStats", label: "必要", filter: "text" },
  { key: "bonus", label: "ボーナス", filter: "text" },
];

export function UnitTab({
  onSelectUnit,
}: {
  onSelectUnit: (name: string) => void;
}) {
  const [units, setUnits] = useState<UnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await fetchUnitTypes();
      setUnits(list);
      setError(null);
    } catch {
      setError("兵種の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(units.map((u) => u.category.trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [units]
  );

  // 得意兵種フィルタ用: 全兵種から個別トークンを収集
  const goodAgainstOptions = useMemo(
    () =>
      Array.from(
        new Set(units.flatMap((u) => splitGoodAgainst(u.goodAgainst)))
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [units]
  );

  // 必要能力値セレクタの候補（基本候補 + データ中に現れるもの）
  const statOptions = useMemo(() => {
    const found = units
      .map((u) => parseReqStats(u.reqStats).stat)
      .filter(Boolean);
    return Array.from(new Set([...BASE_STAT_OPTIONS, ...found]));
  }, [units]);

  const filtered = useMemo(() => {
    const result = units.filter((u) =>
      COLUMNS.every((col) => {
        const f = filters[col.key]?.trim();
        if (!f) return true;
        if (col.filter === "tokens") {
          return splitGoodAgainst(String(u[col.key] ?? "")).includes(f);
        }
        const cell = String(u[col.key] ?? "");
        if (col.filter === "select") return cell === f;
        return cell.toLowerCase().includes(f.toLowerCase());
      })
    );
    const col = COLUMNS.find((c) => c.key === sortKey);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      if (col?.numeric) {
        return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
      }
      return (
        String(a[sortKey] ?? "").localeCompare(
          String(b[sortKey] ?? ""),
          "ja"
        ) * dir
      );
    });
  }, [units, filters, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const setFilter = (key: SortKey, value: string) => {
    setFilters((cur) => ({ ...cur, [key]: value }));
  };

  const hasFilter = Object.values(filters).some((v) => !!v && !!v.trim());

  const openNew = () => {
    setAdding(true);
  };

  return (
    <section className="panel">
      <div className="history-head">
        <h2>兵種図鑑</h2>
        {!loading && (
          <span className="count-badge">
            {hasFilter
              ? `全${units.length.toLocaleString("ja-JP")}件中 ${filtered.length.toLocaleString("ja-JP")}件`
              : `全${units.length.toLocaleString("ja-JP")}件`}
          </span>
        )}
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={openNew}>
          兵種を追加
        </button>
        {hasFilter && (
          <button
            type="button"
            className="btn"
            onClick={() => setFilters({})}
          >
            フィルタをクリア
          </button>
        )}
      </div>

      {error && <p className="muted">{error}</p>}

      <p className="sr-only" role="status" aria-live="polite">
        {filtered.length.toLocaleString("ja-JP")}件の兵種を表示
      </p>

      <div className="table-wrap">
        <table className="unit-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th key={col.key}>
                    <button
                      type="button"
                      className={`th-sort${active ? " active" : ""}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <span className="sort-ind">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="filter-row">
              {COLUMNS.map((col) => {
                const options =
                  col.filter === "select"
                    ? categories
                    : col.filter === "tokens"
                    ? goodAgainstOptions
                    : null;
                return (
                  <th key={col.key}>
                    {options ? (
                      <select
                        className="col-filter"
                        value={filters[col.key] ?? ""}
                        onChange={(e) => setFilter(col.key, e.target.value)}
                        aria-label={`${col.label}で絞り込み`}
                      >
                        <option value="">すべて</option>
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="col-filter"
                        value={filters[col.key] ?? ""}
                        onChange={(e) => setFilter(col.key, e.target.value)}
                        placeholder="絞り込み"
                        aria-label={`${col.label}で絞り込み`}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="muted"
                  style={{ padding: 16, textAlign: "center" }}
                >
                  読み込み中…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="muted"
                  style={{ padding: 16, textAlign: "center" }}
                >
                  兵種がありません
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr
                  key={u.name}
                  onClick={() => onSelectUnit(u.name)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <button
                      type="button"
                      className="link-like"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectUnit(u.name);
                      }}
                      title={`${u.name} の詳細を見る`}
                    >
                      {u.name}
                    </button>
                  </td>
                  <td>
                    {u.category ? (
                      <span className="tag branch">{u.category}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {splitGoodAgainst(u.goodAgainst).length > 0 ? (
                      <span className="tag-list">
                        {splitGoodAgainst(u.goodAgainst).map((g) => (
                          <span key={g} className="tag unit">
                            {g}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{u.attack}</td>
                  <td>{u.defense}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {u.cost || "-"}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {u.reqStats || "-"}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {u.bonus || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <UnitEditModal
          initial={EMPTY_UNIT}
          isNew
          statOptions={statOptions}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
    </section>
  );
}
