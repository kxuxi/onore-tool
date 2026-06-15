"use client";

import { useEffect, useMemo, useState } from "react";
import type { BattleRecord } from "@/lib/types";
import { parseActionDate } from "@/lib/action";

interface Props {
  onRegister: (text: string) => {
    added: number;
    updated: number;
    parsed: number;
    skipped: number;
  };
  log: BattleRecord[];
}

const PAGE_SIZE = 20;

const PLACEHOLDER = `戦闘履歴をここに貼り付けてください。
例:
【1戦目】\t1583年4月\t10:23\t京都\t織田家\t織田信長\t織田\t武統\t重騎兵\t騎兵\t名刀\t名馬\tV.S.\t武田家\t武田勝頼\t武田\t武特\t精鋭騎馬\t騎兵\t名刀\t名馬\t勝利\t12`;

export function HistoryTab({ onRegister, log }: Props) {
  const [text, setText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<
    | null
    | {
        kind: "success";
        added: number;
        updated: number;
        parsed: number;
        skipped: number;
      }
    | { kind: "warn"; message: string }
  >(null);

  const handleRegister = () => {
    const r = onRegister(text);
    if (r.parsed === 0) {
      setResult({
        kind: "warn",
        message:
          "解析できる行が見つかりませんでした。タブ区切りで貼り付けてください。",
      });
      return;
    }
    setResult({ kind: "success", ...r });
  };

  const handleClear = () => {
    setText("");
    setResult(null);
  };

  // 戦闘時刻の降順（新しい順）で表示。キーワードで絞り込み。
  const visibleLog = useMemo(() => {
    const k = keyword.trim();
    const list = k ? log.filter((r) => r.line.includes(k)) : log;
    const now = new Date();
    const timeOf = (r: BattleRecord) =>
      parseActionDate(r.time, now)?.getTime() ?? null;
    return [...list].sort((a, b) => {
      const ta = timeOf(a);
      const tb = timeOf(b);
      // 戦闘時刻があるものを優先し、新しい順。両方無ければ登録の新しい順。
      if (ta != null && tb != null) {
        if (tb !== ta) return tb - ta;
        return b.savedAt - a.savedAt;
      }
      if (ta != null) return -1;
      if (tb != null) return 1;
      return b.savedAt - a.savedAt;
    });
  }, [log, keyword]);

  const totalPages = Math.max(1, Math.ceil(visibleLog.length / PAGE_SIZE));

  // 絞り込み・件数変化でページ範囲を補正
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  // キーワード変更時は1ページ目へ
  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleLog.slice(start, start + PAGE_SIZE);
  }, [visibleLog, page]);

  return (
    <>
      <section className="panel">
        <h2>戦闘履歴を登録</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          ゲームからコピーした戦闘履歴（タブ区切り）を貼り付けて「登録する」を押してください。
          攻撃側・防衛側どちらの武将も自動で抽出されます。同じ内容の行は重複登録されません。
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRegister}
            disabled={!text.trim()}
          >
            登録する
          </button>
          <button type="button" className="btn" onClick={handleClear}>
            クリア
          </button>
        </div>

        {result?.kind === "success" && (
          <div className="stat-grid">
            <div className="stat">
              <div className="label">解析行(武将数)</div>
              <div className="value">{result.parsed}</div>
            </div>
            <div className="stat">
              <div className="label">新規登録</div>
              <div className="value">{result.added}</div>
            </div>
            <div className="stat">
              <div className="label">上書き更新</div>
              <div className="value">{result.updated}</div>
            </div>
            <div className="stat">
              <div className="label">重複スキップ</div>
              <div className="value">{result.skipped}</div>
            </div>
          </div>
        )}
        {result?.kind === "warn" && (
          <div className="tag warn" role="alert">
            {result.message}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>登録済み戦闘履歴</h2>
        <div className="row">
          <input
            type="search"
            className="text-input"
            placeholder="履歴を絞り込み（武将名など）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <span className="muted" style={{ fontSize: 13 }}>
            {visibleLog.length} / {log.length} 件
          </span>
        </div>

        {visibleLog.length === 0 ? (
          <div className="empty">
            {log.length === 0
              ? "まだ登録された戦闘履歴はありません。"
              : "条件に一致する履歴がありません。"}
          </div>
        ) : (
          <>
            <ul className="log-list">
              {pageItems.map((r, i) => (
                <li
                  key={`${r.savedAt}-${i}-${r.line.slice(0, 16)}`}
                  className="log-item"
                >
                  {r.time && <span className="log-time">{r.time}</span>}
                  <span className="log-line">{r.line}</span>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="pager">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  前へ
                </button>
                <span className="pager-info">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
