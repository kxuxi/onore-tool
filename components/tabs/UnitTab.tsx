"use client";

import { useEffect, useMemo, useState } from "react";
import type { UnitType } from "@/lib/types";
import {
  deleteUnitType,
  fetchUnitTypes,
  upsertUnitType,
} from "@/lib/api";

const EMPTY: UnitType = {
  name: "",
  category: "",
  goodAgainst: "",
  attack: 0,
  defense: 0,
  cost: "",
  tech: "",
  years: "",
  reqStats: "",
  facility: "",
  special: "",
  bonus: "",
};

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

/** 必要能力値セレクタの基本候補 */
const BASE_STAT_OPTIONS = ["統率", "武力", "知力", "政治"];

/** "弓兵:壁:" のような区切り文字列を ["弓兵", "壁"] に分解 */
function splitGoodAgainst(value: string): string[] {
  return value
    .split(/[:：]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "武力:40" を { stat: "武力", num: "40" } に分解 */
function parseReqStats(value: string): { stat: string; num: string } {
  const m = value.match(/^\s*([^:：]+)[:：]\s*(.*)$/);
  if (m) return { stat: m[1].trim(), num: m[2].trim() };
  return { stat: value.trim(), num: "" };
}

/** ステータス名と数値を "武力:40" 形式に再構成 */
function composeReqStats(stat: string, num: string): string {
  const s = stat.trim();
  if (!s) return "";
  return `${s}:${num.trim()}`;
}

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
  const [editing, setEditing] = useState<UnitType | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
    setEditing({ ...EMPTY });
    setIsNew(true);
    setError(null);
  };

  const openEdit = (u: UnitType) => {
    setEditing({ ...u });
    setIsNew(false);
    setError(null);
  };

  const closeForm = () => {
    setEditing(null);
    setIsNew(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("兵種名は必須です");
      return;
    }
    setBusy(true);
    try {
      await upsertUnitType({ ...editing, name: editing.name.trim() });
      await reload();
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (name: string) => {
    setBusy(true);
    try {
      await deleteUnitType(name);
      await reload();
      setConfirmDelete(null);
      closeForm();
    } catch {
      setError("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const update = <K extends keyof UnitType>(key: K, value: UnitType[K]) => {
    setEditing((cur) => (cur ? { ...cur, [key]: value } : cur));
  };

  const reqStats = editing
    ? parseReqStats(editing.reqStats)
    : { stat: "", num: "" };

  return (
    <section className="panel">
      <h2>兵種図鑑</h2>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">登録兵種数</div>
          <div className="value">{units.length}</div>
        </div>
        <div className="stat">
          <div className="label">絞り込み結果</div>
          <div className="value">{filtered.length}</div>
        </div>
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

      {error && !editing && <p className="muted">{error}</p>}

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
              <th></th>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="muted"
                  style={{ padding: 16, textAlign: "center" }}
                >
                  読み込み中…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
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
                  onClick={() => openEdit(u)}
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
                      title={`${u.name} の戦績を見る`}
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
                  <td>
                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(u);
                      }}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="modal-backdrop"
          onClick={closeForm}
          role="presentation"
        >
          <div
            className="modal"
            role="dialog"
            aria-labelledby="unit-form-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560, width: "92%" }}
          >
            <h3 id="unit-form-title">
              {isNew ? "兵種を追加" : `兵種を編集: ${editing.name}`}
            </h3>

            <div className="unit-form">
              <label className="filter">
                <span>兵種名 *</span>
                <input
                  className="text-input"
                  value={editing.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="例: カノン砲"
                />
              </label>
              <label className="filter">
                <span>種類</span>
                <input
                  className="text-input"
                  value={editing.category}
                  onChange={(e) => update("category", e.target.value)}
                  placeholder="例: 弓兵"
                />
              </label>
              <label className="filter">
                <span>得意兵種</span>
                <input
                  className="text-input"
                  value={editing.goodAgainst}
                  onChange={(e) => update("goodAgainst", e.target.value)}
                  placeholder="例: 歩兵:壁:"
                />
              </label>
              <label className="filter">
                <span>攻撃</span>
                <input
                  type="number"
                  className="text-input"
                  value={editing.attack}
                  onChange={(e) =>
                    update("attack", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="filter">
                <span>防御</span>
                <input
                  type="number"
                  className="text-input"
                  value={editing.defense}
                  onChange={(e) =>
                    update("defense", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="filter">
                <span>雇用金</span>
                <input
                  className="text-input"
                  value={editing.cost}
                  onChange={(e) => update("cost", e.target.value)}
                  placeholder="例: 金:600"
                />
              </label>
              <label className="filter">
                <span>技術</span>
                <input
                  className="text-input"
                  value={editing.tech}
                  onChange={(e) => update("tech", e.target.value)}
                />
              </label>
              <label className="filter">
                <span>年数</span>
                <input
                  className="text-input"
                  value={editing.years}
                  onChange={(e) => update("years", e.target.value)}
                  placeholder="例: 36年"
                />
              </label>
              <label className="filter">
                <span>必要能力値</span>
                <div className="req-stats-group">
                  <select
                    className="select"
                    value={reqStats.stat}
                    onChange={(e) =>
                      update(
                        "reqStats",
                        composeReqStats(e.target.value, reqStats.num)
                      )
                    }
                  >
                    <option value="">なし</option>
                    {statOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="text-input"
                    value={reqStats.num}
                    onChange={(e) =>
                      update(
                        "reqStats",
                        composeReqStats(reqStats.stat, e.target.value)
                      )
                    }
                    placeholder="数値"
                    disabled={!reqStats.stat}
                  />
                </div>
              </label>
              <label className="filter">
                <span>施設/国宝</span>
                <input
                  className="text-input"
                  value={editing.facility}
                  onChange={(e) => update("facility", e.target.value)}
                  placeholder="例: 鉄工所,南蛮町"
                />
              </label>
              <label className="filter" style={{ gridColumn: "1 / -1" }}>
                <span>特殊攻撃</span>
                <textarea
                  className="text-input"
                  rows={3}
                  value={editing.special}
                  onChange={(e) => update("special", e.target.value)}
                />
              </label>
              <label className="filter" style={{ gridColumn: "1 / -1" }}>
                <span>ボーナス</span>
                <input
                  className="text-input"
                  value={editing.bonus}
                  onChange={(e) => update("bonus", e.target.value)}
                  placeholder="例: 兵種アタック+12%"
                />
              </label>
            </div>

            {error && <p className="muted">{error}</p>}

            <div className="row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={busy}
              >
                {busy ? "保存中…" : isNew ? "追加する" : "保存する"}
              </button>
              <button type="button" className="btn" onClick={closeForm}>
                キャンセル
              </button>
              {!isNew && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setConfirmDelete(editing.name)}
                  disabled={busy}
                  style={{ marginLeft: "auto" }}
                >
                  削除
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDelete(null)}
          role="presentation"
        >
          <div
            className="modal"
            role="alertdialog"
            aria-labelledby="unit-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="unit-delete-title">兵種を削除しますか？</h3>
            <p>「{confirmDelete}」を削除します。この操作は元に戻せません。</p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmDelete(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(confirmDelete)}
                disabled={busy}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
