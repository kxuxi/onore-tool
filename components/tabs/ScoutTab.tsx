"use client";

import { useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import { lookup } from "@/lib/storage";

interface Props {
  db: WarlordMap;
}

interface Row {
  name: string;
  faction?: string;
  type?: string;
  branch?: string;
  unit?: string;
  found: boolean;
}

function splitNames(text: string): string[] {
  // 改行 / 半角空白 / 全角空白 / タブ / 読点 / カンマで分割
  return text
    .split(/[\s\u3000、,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function ScoutTab({ db }: Props) {
  const [text, setText] = useState("");

  const rows = useMemo<Row[]>(() => {
    const names = splitNames(text);
    // 重複は1回だけ
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const n of names) {
      if (!seen.has(n)) {
        seen.add(n);
        unique.push(n);
      }
    }
    return unique.map((name) => {
      const w = lookup(db, name);
      if (!w) return { name, found: false };
      return {
        name,
        faction: w.faction,
        type: w.type,
        branch: w.branch,
        unit: w.unit,
        found: true,
      };
    });
  }, [text, db]);

  const foundCount = rows.filter((r) => r.found).length;

  return (
    <section className="panel">
      <h2>偵察検索</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        偵察結果の武将名をスペース・改行・カンマ区切りで貼り付けてください。
        DBに登録済みの武将はタイプ・兵科を表示します。
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`例:\n織田信長 武田勝頼 上杉謙信\n徳川家康`}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      {rows.length > 0 && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label">入力</div>
              <div className="value">{rows.length}</div>
            </div>
            <div className="stat">
              <div className="label">ヒット</div>
              <div className="value">{foundCount}</div>
            </div>
            <div className="stat">
              <div className="label">未登録</div>
              <div className="value">{rows.length - foundCount}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>国</th>
                  <th>武将名</th>
                  <th>タイプ</th>
                  <th>兵科</th>
                  <th>兵種</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td>
                      {r.found && r.faction ? (
                        <span className="tag faction">{r.faction}</span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>{r.name}</td>
                    <td>
                      {r.found ? (
                        <span className="tag type">{r.type}</span>
                      ) : (
                        <span className="tag warn">データなし</span>
                      )}
                    </td>
                    <td>
                      {r.found ? (
                        <span className="tag branch">{r.branch}</span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>
                      {r.found && r.unit ? (
                        <span className="tag unit">{r.unit}</span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
