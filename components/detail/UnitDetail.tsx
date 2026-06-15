"use client";

import { useMemo } from "react";
import type { BattleRecord } from "@/lib/types";
import { collectUnitBattles, summarize } from "@/lib/stats";
import { PieChart, chartColor } from "@/components/PieChart";
import { BattleLogList } from "@/components/detail/BattleLogList";
import {
  DetailHeader,
  StatCards,
  WinRateBar,
} from "@/components/detail/DetailParts";

interface Props {
  name: string;
  log: BattleRecord[];
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
  onBack: () => void;
}

export function UnitDetail({
  name,
  log,
  onSelectWarlord,
  onSelectUnit,
  onBack,
}: Props) {
  const outcomes = useMemo(() => collectUnitBattles(log, name), [log, name]);
  const summary = useMemo(() => summarize(outcomes), [outcomes]);

  // この兵種を使った武将の内訳（多い順）。
  const userUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of outcomes) {
      map.set(o.self.name, (map.get(o.self.name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([n, count]) => ({ name: n, count }))
      .sort((a, b) => b.count - a.count);
  }, [outcomes]);

  const pieData = useMemo(
    () =>
      userUsage.map((u, i) => ({
        label: u.name,
        value: u.count,
        color: chartColor(i),
      })),
    [userUsage]
  );
  const usageTotal = userUsage.reduce((s, u) => s + u.count, 0);

  return (
    <section className="panel detail-panel">
      <DetailHeader
        kind="兵種"
        title={name}
        tags={<span className="tag unit">兵種</span>}
        onBack={onBack}
      />

      {outcomes.length === 0 ? (
        <div className="empty">
          この兵種が使われた戦闘履歴がまだありません。
        </div>
      ) : (
        <>
          <StatCards summary={summary} />
          <WinRateBar summary={summary} />

          <div className="detail-section">
            <h3>この兵種を使った武将</h3>
            <div className="pie-block">
              <PieChart data={pieData} />
              <ul className="pie-legend">
                {userUsage.map((u, i) => {
                  const pct =
                    usageTotal > 0
                      ? Math.round((u.count / usageTotal) * 100)
                      : 0;
                  return (
                    <li key={u.name} className="pie-legend-item">
                      <span
                        className="pie-dot"
                        style={{ background: chartColor(i) }}
                      />
                      <button
                        type="button"
                        className="pie-legend-name link-like"
                        onClick={() => onSelectWarlord(u.name)}
                        title={`${u.name} の戦績を見る`}
                      >
                        {u.name}
                      </button>
                      <span className="pie-legend-val">
                        {u.count}戦 ({pct}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="detail-section">
            <h3>戦闘ログ（{outcomes.length}件）</h3>
            <BattleLogList
              outcomes={outcomes}
              currentUnit={name}
              onSelectWarlord={onSelectWarlord}
              onSelectUnit={onSelectUnit}
            />
          </div>
        </>
      )}
    </section>
  );
}
