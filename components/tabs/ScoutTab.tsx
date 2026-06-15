"use client";

import { useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import { lookup } from "@/lib/storage";
import { normalizeDisplayToken } from "@/lib/parser";
import { shortUnit } from "@/lib/unitShortNames";
import { copyText } from "@/lib/clipboard";

interface Props {
  db: WarlordMap;
  onSelectWarlord: (name: string) => void;
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

/**
 * タイプを報告用に短縮する。
 * 「政治家」→「政」、「知特/武特/統特」→末尾の「特」を除去。
 * 統武・知武などの 2 文字複合タイプや「謎」はそのまま。
 */
function shortType(type: string | undefined): string {
  if (!type) return "？";
  if (type === "政治家") return "政";
  if (type.length === 2 && type.endsWith("特")) return type[0];
  return type;
}

export function ScoutTab({ db, onSelectWarlord }: Props) {
  const [text, setText] = useState("");
  const [unregisteredOnly, setUnregisteredOnly] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [reportCopied, setReportCopied] = useState<"idle" | "ok" | "fail">(
    "idle"
  );

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

  // 「未登録のみ表示」を適用した表示用リスト。
  const visibleRows = unregisteredOnly ? rows.filter((r) => !r.found) : rows;

  const handleCopy = async () => {
    if (visibleRows.length === 0) return;
    const tsv = visibleRows
      .map((r) =>
        r.found
          ? [r.name, r.type ?? "", r.branch ?? "", r.unit ?? ""].join("\t")
          : `${r.name}\t未登録`
      )
      .join("\n");
    const ok = await copyText(tsv);
    setCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setCopied("idle"), 1800);
  };

  // 国へ敵の守備の並びを報告するためのテキスト。
  // 「名前［タイプ｜兵種］」を入力順に、読点で連結した形。未登録は［？］。
  const reportText = useMemo(
    () =>
      rows
        .map((r) => {
          if (!r.found) return `${r.name}［？］`;
          const unit = r.unit ? shortUnit(normalizeDisplayToken(r.unit)) : "？";
          return `${r.name}［${shortType(r.type)}｜${unit}］`;
        })
        .join(", "),
    [rows]
  );

  const handleCopyReport = async () => {
    if (!reportText) return;
    const ok = await copyText(reportText);
    setReportCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setReportCopied("idle"), 1800);
  };

  return (
    <section className="panel">
      <h2>偵察検索</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        偵察結果の武将名をスペース・改行・カンマ区切りで貼り付けてください。
        DBに登録済みの武将はタイプ・兵科・兵種を表示し、「名前［タイプ｜兵種］」形式の報告用テキストも生成します。
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
          <div className="scout-report">
            <div className="scout-report-head">
              <span className="scout-report-title">
                報告用テキスト（タイプ｜兵種）
                <span className="scout-report-count">{rows.length}件</span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={handleCopyReport}
                disabled={!reportText}
              >
                {reportCopied === "ok"
                  ? "コピーしました"
                  : reportCopied === "fail"
                    ? "コピーできませんでした"
                    : "報告用をコピー"}
              </button>
            </div>
            <textarea
              className="scout-report-text"
              readOnly
              value={reportText}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div className="scout-controls">
            <label className="scout-toggle">
              <input
                type="checkbox"
                checked={unregisteredOnly}
                onChange={(e) => setUnregisteredOnly(e.target.checked)}
              />
              <span>未登録のみ表示</span>
            </label>
            <button
              type="button"
              className="btn"
              onClick={handleCopy}
              disabled={visibleRows.length === 0}
            >
              {copied === "ok"
                ? "コピーしました"
                : copied === "fail"
                  ? "コピーできませんでした"
                  : "結果をコピー"}
            </button>
          </div>
          {visibleRows.length === 0 ? (
            <div className="empty">未登録の武将はありません。</div>
          ) : (
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
                  {visibleRows.map((r) => (
                    <tr key={r.name}>
                      <td>
                        {r.found && r.faction ? (
                          <span className="tag faction">{r.faction}</span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-like"
                          onClick={() => onSelectWarlord(r.name)}
                          title={`${r.name} の戦績を見る`}
                        >
                          {r.name}
                        </button>
                      </td>
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
          )}
        </>
      )}
    </section>
  );
}
