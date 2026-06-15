"use client";

import { useEffect, useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import {
  ACTION_LABEL,
  formatElapsed,
  getActionInfo,
  STATUS_ORDER,
  type ActionStatus,
} from "@/lib/action";

interface Props {
  db: WarlordMap;
}

const STATUS_CLASS: Record<ActionStatus, string> = {
  done: "status done",
  ready: "status ready",
  unknown: "status unknown",
  none: "status none",
};

export function DamageTab({ db }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | ActionStatus>("");
  const [factionFilter, setFactionFilter] = useState("");

  // 経過時間をリアルタイム表示するため 30 秒ごとに現在時刻を更新
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    if (!now) return [];
    return Object.values(db)
      .map((w) => ({ w, info: getActionInfo(w, now) }))
      .filter((r) => r.info.status !== "none")
      .filter((r) => (statusFilter ? r.info.status === statusFilter : true))
      .filter((r) => (factionFilter ? r.w.faction === factionFilter : true))
      .sort((a, b) => {
        // 行動可 → 不明 → 行動済みの順。
        // 同ステータス内は経過時間の昇順（短い＝さっき行動可になった人が上）。
        const so = STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status];
        if (so !== 0) return so;
        return (a.info.minutes ?? 0) - (b.info.minutes ?? 0);
      });
  }, [db, now, statusFilter, factionFilter]);

  // 国の選択肢（行動時刻を持つ武将の勢力名）
  const factionOptions = useMemo(() => {
    return Array.from(
      new Set(
        Object.values(db)
          .filter((w) => w.lastActionAt)
          .map((w) => w.faction?.trim())
          .filter((v): v is string => !!v)
      )
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [db]);

  const counts = useMemo(() => {
    const c = { done: 0, ready: 0, unknown: 0 };
    if (!now) return c;
    for (const w of Object.values(db)) {
      const { status } = getActionInfo(w, now);
      if (status === "done") c.done++;
      else if (status === "ready") c.ready++;
      else if (status === "unknown") c.unknown++;
    }
    return c;
  }, [db, now]);

  return (
    <section className="panel">
      <h2>被弾表（行動状況）</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        各武将の行動時刻からの経過時間で行動状況を判定します。
        40分以内=行動済み / 40分〜1時間20分=行動可 / 1時間20分以上=不明。
      </p>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">行動可</div>
          <div className="value">{counts.ready}</div>
        </div>
        <div className="stat">
          <div className="label">行動済み</div>
          <div className="value">{counts.done}</div>
        </div>
        <div className="stat">
          <div className="label">不明</div>
          <div className="value">{counts.unknown}</div>
        </div>
      </div>

      <div className="filter-grid">
        <label className="filter">
          <span>ステータス</span>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | ActionStatus)
            }
          >
            <option value="">すべて</option>
            <option value="ready">行動可</option>
            <option value="done">行動済み</option>
            <option value="unknown">不明</option>
          </select>
        </label>
        <label className="filter">
          <span>国</span>
          <select
            className="select"
            value={factionFilter}
            onChange={(e) => setFactionFilter(e.target.value)}
          >
            <option value="">すべて</option>
            {factionOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">
            行動時刻が記録された武将がいません。戦闘履歴を登録してください。
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>状況</th>
                <th>国</th>
                <th>武将名</th>
                <th>タイプ</th>
                <th>兵科</th>
                <th>兵種</th>
                <th>行動時刻</th>
                <th>経過</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ w, info }) => (
                <tr key={w.name}>
                  <td>
                    <span className={STATUS_CLASS[info.status]}>
                      {ACTION_LABEL[info.status]}
                    </span>
                    {info.noRest && (
                      <span className="status no-rest">休養なし</span>
                    )}
                  </td>
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
                  <td className="muted" style={{ fontSize: 12 }}>
                    {formatElapsed(info.minutes)}
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
