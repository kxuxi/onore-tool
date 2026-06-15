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

export function UnitTab() {
  const [units, setUnits] = useState<UnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
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

  const filtered = useMemo(() => {
    const k = keyword.trim();
    return units.filter((u) => {
      if (k && !u.name.includes(k)) return false;
      if (category && u.category !== category) return false;
      return true;
    });
  }, [units, keyword, category]);

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
        <input
          type="search"
          className="text-input"
          placeholder="兵種名で絞り込み"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="button" className="btn btn-primary" onClick={openNew}>
          兵種を追加
        </button>
      </div>

      <div className="filter-grid">
        <label className="filter">
          <span>種類</span>
          <select
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">すべて</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && !editing && <p className="muted">{error}</p>}

      <div className="table-wrap">
        {loading ? (
          <p className="muted" style={{ padding: 12 }}>
            読み込み中…
          </p>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            兵種がありません
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>兵種</th>
                <th>種類</th>
                <th>得意</th>
                <th>攻</th>
                <th>防</th>
                <th>雇用</th>
                <th>必要</th>
                <th>ボーナス</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.name}
                  onClick={() => openEdit(u)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{u.name}</td>
                  <td>
                    {u.category ? (
                      <span className="tag branch">{u.category}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {u.goodAgainst || "-"}
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
              ))}
            </tbody>
          </table>
        )}
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
                <input
                  className="text-input"
                  value={editing.reqStats}
                  onChange={(e) => update("reqStats", e.target.value)}
                  placeholder="例: 政治:250"
                />
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
