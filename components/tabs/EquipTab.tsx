"use client";

import { useMemo, useState } from "react";
import type { BattleRecord } from "@/lib/types";
import { equipStats } from "@/lib/stats";

interface Props {
  log: BattleRecord[];
  onSelectWarlord: (name: string) => void;
}

type SortKey = "battles" | "winRate" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "battles", label: "使用回数（多い順）" },
  { key: "winRate", label: "勝率（高い順）" },
  { key: "name", label: "名前（あいうえお順）" },
];

/** 勝率の信頼度を確保するための最低使用回数の選択肢。 */
const MIN_USE_OPTIONS = [1, 10, 50, 100];

export function EquipTab({ log, onSelectWarlord }: Props) {
  const [keyword, setKeyword] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("battles");
  const [minUses, setMinUses] = useState(10);

  const stats = useMemo(() => equipStats(log), [log]);

  const view = useMemo(() => {
    const k = keyword.trim();
    const filtered = stats.filter(
      (e) => e.battles >= minUses && (k ? e.name.includes(k) : true)
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === "winRate") {
        return b.winRate - a.winRate || b.battles - a.battles;
      }
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, "ja");
      }
      return b.battles - a.battles || b.winRate - a.winRate;
    });
  }, [stats, keyword, sortKey, minUses]);

  return (
    <section className="panel">
      <h2>武器・品物図鑑</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        戦闘履歴の装備1・装備2（武器・品物）を集計し、使用回数・勝率・主な使用武将を表示します。
        勝率は勝敗が確定した戦闘のみで算出します。
      </p>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">装備の種類</div>
          <div className="value">{stats.length}</div>
        </div>
        <div className="stat">
          <div className="label">絞り込み結果</div>
          <div className="value">{view.length}</div>
        </div>
      </div>

      <div className="row">
        <input
          type="search"
          className="text-input"
          placeholder="装備名で絞り込み"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <div className="filter-grid">
        <label className="filter">
          <span>並べ替え</span>
          <select
            className="select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>最低使用回数</span>
          <select
            className="select"
            value={minUses}
            onChange={(e) => setMinUses(Number(e.target.value))}
          >
            {MIN_USE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}回以上
              </option>
            ))}
          </select>
        </label>
      </div>

      {view.length === 0 ? (
        <div className="empty">
          <p className="empty-title">該当する装備がありません</p>
          <p className="empty-hint">
            「戦闘履歴」タブで戦績を登録すると、装備1・装備2のデータから図鑑を作成します。
            すでに登録済みの場合は、検索語や最低使用回数の条件を見直してください。
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table-card">
            <thead>
              <tr>
                <th>装備</th>
                <th>使用回数</th>
                <th>勝率</th>
                <th>攻 / 守</th>
                <th>主な使用武将</th>
              </tr>
            </thead>
            <tbody>
              {view.map((e) => (
                <tr key={e.name}>
                  <td className="cell-title">
                    <span className="tag unit">{e.name}</span>
                  </td>
                  <td data-label="使用回数">{e.battles}</td>
                  <td data-label="勝率">
                    <span>
                      {e.decided > 0 ? (
                        <>
                          {(e.winRate * 100).toFixed(1)}%
                          <span className="muted equip-decided">
                            （{e.wins}/{e.decided}）
                          </span>
                        </>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </span>
                  </td>
                  <td className="equip-split" data-label="攻 / 守">
                    <span>
                      {e.attackUses} / {e.defenseUses}
                    </span>
                  </td>
                  <td className="cell-block" data-label="主な使用武将">
                    <span className="equip-users">
                      {e.topUsers.map((u) => (
                        <button
                          key={u.name}
                          type="button"
                          className="link-like"
                          onClick={() => onSelectWarlord(u.name)}
                          title={`${u.name} の戦績を見る`}
                        >
                          {u.name}
                          <span className="muted">×{u.count}</span>
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
