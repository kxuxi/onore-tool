"use client";

import { useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import { copyText } from "@/lib/clipboard";

interface Props {
  db: WarlordMap;
  onSelectWarlord: (name: string) => void;
}

/** 並び替えできる列キー（updatedAt は既定の更新日時順）。 */
type SortKey =
  | "faction"
  | "name"
  | "type"
  | "branch"
  | "unit"
  | "lastActionAt"
  | "updatedAt";

export function DbTab({ db, onSelectWarlord }: Props) {
  const [keyword, setKeyword] = useState("");
  const [faction, setFaction] = useState("");
  const [type, setType] = useState("");
  const [branch, setBranch] = useState("");
  const [unit, setUnit] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [copied, setCopied] = useState(false);

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
    // 武将名検索は大文字小文字を区別しない（他タブと挙動を揃える）。
    const k = keyword.trim().toLowerCase();
    const list = all.filter((w) => {
      if (k && !w.name.toLowerCase().includes(k)) return false;
      if (faction && w.faction !== faction) return false;
      if (type && w.type !== type) return false;
      if (branch && w.branch !== branch) return false;
      if (unit && w.unit !== unit) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const strOf = (w: (typeof all)[number]): string => {
      switch (sortKey) {
        case "faction":
          return w.faction ?? "";
        case "name":
          return w.name;
        case "type":
          return w.type;
        case "branch":
          return w.branch;
        case "unit":
          return w.unit ?? "";
        case "lastActionAt":
          return w.lastActionAt ?? "";
        default:
          return "";
      }
    };
    return [...list].sort((a, b) => {
      if (sortKey === "updatedAt") return (a.updatedAt - b.updatedAt) * dir;
      const av = strOf(a);
      const bv = strOf(b);
      // 空値は並び順に関わらず常に末尾へ。
      if (!av && bv) return 1;
      if (av && !bv) return -1;
      if (!av && !bv) return a.name.localeCompare(b.name, "ja");
      const c = av.localeCompare(bv, "ja");
      return c !== 0 ? c * dir : a.name.localeCompare(b.name, "ja");
    });
  }, [all, keyword, faction, type, branch, unit, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 既定は文字列=昇順、更新日時=降順。
      setSortDir(key === "updatedAt" ? "desc" : "asc");
    }
  };

  const hasFilter = !!(keyword || faction || type || branch || unit);

  const clearFilters = () => {
    setKeyword("");
    setFaction("");
    setType("");
    setBranch("");
    setUnit("");
  };

  // 絞り込み中の一覧をタブ区切り（TSV）でクリップボードへコピーする。
  const handleCopyTsv = async () => {
    if (filtered.length === 0) return;
    const header = ["国", "武将名", "タイプ", "兵科", "兵種", "行動時間"].join(
      "\t"
    );
    const lines = filtered.map((w) =>
      [
        w.faction ?? "",
        w.name,
        w.type,
        w.branch,
        w.unit ?? "",
        w.lastActionAt ?? "",
      ].join("\t")
    );
    const ok = await copyText([header, ...lines].join("\n"));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="panel">
      <h2>DB確認</h2>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">登録武将数</div>
          <div className="value">{all.length.toLocaleString("ja-JP")}</div>
        </div>
        <div className="stat">
          <div className="label">絞り込み結果</div>
          <div className="value">{filtered.length.toLocaleString("ja-JP")}</div>
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

      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={handleCopyTsv}
          disabled={filtered.length === 0}
        >
          {copied ? "コピーしました" : "結果をコピー(TSV)"}
        </button>
        {hasFilter && (
          <button type="button" className="btn" onClick={clearFilters}>
            絞り込みをクリア
          </button>
        )}
      </div>

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
                <SortableTh label="国" field="faction" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="武将名" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="タイプ" field="type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="兵科" field="branch" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="兵種" field="unit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="行動時間" field="lastActionAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
                  <td>
                    <button
                      type="button"
                      className="link-like"
                      onClick={() => onSelectWarlord(w.name)}
                      title={`${w.name} の戦績を見る`}
                    >
                      {w.name}
                    </button>
                  </td>
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
    </section>
  );
}

/** 並び替え可能な見出しセル。クリックで昇順／降順をトグルする。 */
function SortableTh({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === field;
  return (
    <th
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button type="button" className="th-sort" onClick={() => onSort(field)}>
        <span>{label}</span>
        <span className="th-sort-ind" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
