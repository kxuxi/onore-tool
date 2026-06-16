"use client";

import { useState } from "react";
import type { UnitType } from "@/lib/types";
import { deleteUnitType, upsertUnitType } from "@/lib/api";
import { useModalA11y } from "@/lib/useModalA11y";
import {
  composeCost,
  composeReqStats,
  composeYears,
  parseCost,
  parseReqStats,
  parseYears,
  BASE_STAT_OPTIONS,
  COST_CURRENCIES,
} from "@/lib/unitTypeForm";

interface Props {
  /** 編集対象（新規追加時は空の UnitType） */
  initial: UnitType;
  /** 新規追加かどうか（false なら編集＝削除ボタンを表示） */
  isNew: boolean;
  /** 必要能力値セレクタの候補（基本候補に加えてデータ中の値） */
  statOptions?: string[];
  /** 閉じる（キャンセル） */
  onClose: () => void;
  /** 保存成功時（親側で再読み込みする） */
  onSaved: (saved: UnitType) => void;
  /** 削除成功時 */
  onDeleted?: (name: string) => void;
}

export function UnitEditModal({
  initial,
  isNew,
  statOptions,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [editing, setEditing] = useState<UnitType>({ ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // 削除確認は編集モーダルの上に重なって開くため、最前面のモーダルだけ
  // フォーカストラップを有効にする（背面の編集モーダルは無効化）。
  const formModalRef = useModalA11y<HTMLDivElement>(!confirmDelete, onClose);
  const deleteModalRef = useModalA11y<HTMLDivElement>(!!confirmDelete, () =>
    setConfirmDelete(null)
  );

  const update = <K extends keyof UnitType>(key: K, value: UnitType[K]) => {
    setEditing((cur) => ({ ...cur, [key]: value }));
  };

  const handleSave = async () => {
    if (!editing.name.trim()) {
      setError("兵種名は必須です");
      return;
    }
    setBusy(true);
    try {
      const saved = await upsertUnitType({
        ...editing,
        name: editing.name.trim(),
      });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy(false);
    }
  };

  const handleDelete = async (name: string) => {
    setBusy(true);
    try {
      await deleteUnitType(name);
      setConfirmDelete(null);
      onDeleted?.(name);
    } catch {
      setError("削除に失敗しました");
      setBusy(false);
    }
  };

  const reqStats = parseReqStats(editing.reqStats);
  const cost = parseCost(editing.cost);
  const years = parseYears(editing.years);

  // セレクタ候補（現在値が候補に無ければ補う）
  const stats = Array.from(
    new Set([...BASE_STAT_OPTIONS, ...(statOptions ?? []), reqStats.stat].filter(Boolean))
  );
  const currencies = Array.from(
    new Set([...COST_CURRENCIES, cost.currency].filter(Boolean))
  );

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} role="presentation">
        <div
          ref={formModalRef}
          className="modal unit-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-form-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="unit-form-title">
            {isNew ? "兵種を追加" : `兵種を編集: ${initial.name}`}
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
              <span>攻撃</span>
              <input
                type="number"
                className="text-input"
                value={editing.attack}
                onChange={(e) => update("attack", Number(e.target.value) || 0)}
              />
            </label>
            <label className="filter">
              <span>防御</span>
              <input
                type="number"
                className="text-input"
                value={editing.defense}
                onChange={(e) => update("defense", Number(e.target.value) || 0)}
              />
            </label>
            <label className="filter">
              <span>雇用</span>
              <div className="field-inline">
                <select
                  className="select inline-select"
                  value={cost.currency}
                  onChange={(e) =>
                    update("cost", composeCost(e.target.value, cost.amount))
                  }
                  aria-label="雇用コストの種類（金・米）"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="text-input"
                  value={cost.amount}
                  onChange={(e) =>
                    update("cost", composeCost(cost.currency, e.target.value))
                  }
                  aria-label="雇用コストの金額"
                  placeholder="金額"
                />
              </div>
            </label>
            <label className="filter">
              <span>年数</span>
              <div className="field-inline">
                <input
                  type="number"
                  className="text-input"
                  value={years}
                  onChange={(e) => update("years", composeYears(e.target.value))}
                  aria-label="必要年数"
                  placeholder="例: 36"
                />
                <span className="field-suffix">年</span>
              </div>
            </label>
            <label className="filter">
              <span>必要能力値</span>
              <div className="field-inline">
                <select
                  className="select inline-select"
                  value={reqStats.stat}
                  onChange={(e) =>
                    update(
                      "reqStats",
                      composeReqStats(e.target.value, reqStats.num)
                    )
                  }
                  aria-label="必要能力値の種類"
                >
                  <option value="">なし</option>
                  {stats.map((s) => (
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
                  aria-label="必要能力値の数値"
                  placeholder="数値"
                  disabled={!reqStats.stat}
                />
              </div>
            </label>
            <label className="filter">
              <span>技術</span>
              <input
                className="text-input"
                value={editing.tech}
                onChange={(e) => update("tech", e.target.value)}
              />
            </label>
            <label className="filter" style={{ gridColumn: "1 / -1" }}>
              <span>得意兵種</span>
              <input
                className="text-input"
                value={editing.goodAgainst}
                onChange={(e) => update("goodAgainst", e.target.value)}
                placeholder="例: 歩兵:壁:"
              />
            </label>
            <label className="filter" style={{ gridColumn: "1 / -1" }}>
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

          {error && <p className="form-error">{error}</p>}

          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? "保存中…" : isNew ? "追加する" : "保存する"}
            </button>
            <button type="button" className="btn" onClick={onClose}>
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

      {confirmDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDelete(null)}
          role="presentation"
        >
          <div
            ref={deleteModalRef}
            className="modal"
            role="alertdialog"
            aria-modal="true"
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
    </>
  );
}
