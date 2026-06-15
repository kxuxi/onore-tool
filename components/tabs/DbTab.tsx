"use client";

import { useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";

interface Props {
  db: WarlordMap;
  onReset: () => void;
}

export function DbTab({ db, onReset }: Props) {
  const [keyword, setKeyword] = useState("");
  const [faction, setFaction] = useState("");
  const [type, setType] = useState("");
  const [branch, setBranch] = useState("");
  const [unit, setUnit] = useState("");
  const [confirming, setConfirming] = useState(false);

  const all = useMemo(() => Object.values(db), [db]);

  // 各項目の選択肢（出現する値を昇順で）
  const options = useMemo(() => {
    const collect = (pick: (w: (typeof all)[number]) => string | undefined) =>
      Array.from(
        new Set(
          all
            .map((w) => pick(w)?.trim())
            .filter((v): v is string => !!v)
        )
      ).sort((a, b) => a.localeCompare(b, "ja"));
    return {
      faction: collect((w) => w.faction),
      type: collect((w) => w.type),
      branch: collect((w) => w.branch),
      unit: collect((w) => w.unit),
    };
  }, [all]);

  const filtered = useMemo(() => {
    const k = keyword.trim();
    const list = all.filter((w) => {
      if (k && !w.name.includes(k)) return false;
      if (faction && w.faction !== faction) return false;
      if (type && w.type !== type) return false;
      if (branch && w.branch !== branch) return false;
      if (unit && w.unit !== unit) return false;
      return true;
    });
    // 更新が新しい順
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [all, keyword, faction, type, branch, unit]);

  const hasFilter = !!(keyword || faction || type || branch || unit);

  const clearFilters = () => {
    setKeyword("");
    setFaction("");
    setType("");
    setBranch("");
    setUnit("");
  };

  const handleReset = () => {
    onReset();
    setConfirming(false);
  };

  return (
    <section className="panel">
      <h2>DB確認</h2>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">登録武将数</div>
          <div className="value">{all.length}</div>
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
          placeholder="武将名で絞り込み"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirming(true)}
          disabled={all.length === 0}
        >
          DBをリセット
        </button>
      </div>

      <div className="filter-grid">
        <label className="filter">
          <span>国</span>
          <select
            className="select"
            value={faction}
            onChange={(e) => setFaction(e.target.value)}
          >
            <option value="">すべて</option>
            {options.faction.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>タイプ</span>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">すべて</option>
            {options.type.map((v) => (
              <option key={v} value={v}>
                {v}
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
            {options.branch.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>兵種</span>
          <select
            className="select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">すべて</option>
            {options.unit.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasFilter && (
        <div className="row">
          <button type="button" className="btn" onClick={clearFilters}>
            絞り込みをクリア
          </button>
        </div>
      )}

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            {all.length === 0
              ? "まだ登録された武将はありません。"
              : "条件に一致する武将がいません。"}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>国</th>
                <th>武将名</th>
                <th>タイプ</th>
                <th>兵科</th>
                <th>兵種</th>
                <th>行動時間</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.name}>
                  <td>
                    {w.faction ? (
                      <span className="tag faction">{w.faction}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>{w.name}</td>
                  <td>
                    <span className="tag type">{w.type}</span>
                  </td>
                  <td>
                    <span className="tag branch">{w.branch}</span>
                  </td>
                  <td>
                    {w.unit ? (
                      <span className="tag unit">{w.unit}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {w.lastActionAt ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirming && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirming(false)}
          role="presentation"
        >
          <div
            className="modal"
            role="alertdialog"
            aria-labelledby="db-reset-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="db-reset-title">DBをリセットしますか？</h3>
            <p>
              登録済みの武将データを全て削除します。この操作は元に戻せません。
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleReset}
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
