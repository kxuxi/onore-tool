"use client";

import { useMemo } from "react";
import type { WarlordMap } from "@/lib/types";
import type { BattleRecord } from "@/lib/types";
import { lookup } from "@/lib/storage";
import {
  collectWarlordBattles,
  summarize,
  unitUsage,
  latestSelfProfile,
  matchupRanking,
  branchStats,
  winHeatmap,
  factionTimeline,
} from "@/lib/stats";
import { PieChart, chartColor } from "@/components/PieChart";
import { BattleLogList } from "@/components/detail/BattleLogList";
import {
  DetailHeader,
  StatCards,
  WinRateBar,
} from "@/components/detail/DetailParts";
import {
  MatchupRanking,
  BranchWinRates,
  WinHeatmapSection,
  FactionHistory,
  WarlordComment,
  AbilityStats,
} from "@/components/detail/WarlordInsights";

interface Props {
  name: string;
  db: WarlordMap;
  log: BattleRecord[];
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
  onSelectFaction: (name: string) => void;
  onBack: () => void;
}

export function WarlordDetail({
  name,
  db,
  log,
  onSelectWarlord,
  onSelectUnit,
  onSelectFaction,
  onBack,
}: Props) {
  const outcomes = useMemo(
    () => collectWarlordBattles(log, name),
    [log, name]
  );
  const summary = useMemo(() => summarize(outcomes), [outcomes]);
  const usage = useMemo(() => unitUsage(outcomes), [outcomes]);
  const ranking = useMemo(() => matchupRanking(outcomes), [outcomes]);
  const branches = useMemo(() => branchStats(outcomes), [outcomes]);
  const heatmap = useMemo(() => winHeatmap(outcomes), [outcomes]);
  const timeline = useMemo(() => factionTimeline(outcomes), [outcomes]);

  // プロフィールは DB を優先し、無ければ直近の戦闘から補完する。
  const dbInfo = lookup(db, name);
  const recent = latestSelfProfile(outcomes);
  const faction = dbInfo?.faction ?? recent?.faction;
  const type = dbInfo?.type ?? recent?.type;
  const branch = dbInfo?.branch ?? recent?.branch;

  const pieData = useMemo(
    () =>
      usage.map((u, i) => ({
        label: u.name,
        value: u.count,
        color: chartColor(i),
      })),
    [usage]
  );
  const usageTotal = usage.reduce((s, u) => s + u.count, 0);

  const tags = (
    <>
      {faction && (
        <button
          type="button"
          className="tag faction faction-link"
          onClick={() => onSelectFaction(faction)}
          title={`${faction} の成績を見る`}
        >
          {faction}
        </button>
      )}
      {type && <span className="tag type">{type}</span>}
      {branch && <span className="tag branch">{branch}</span>}
    </>
  );

  return (
    <section className="panel detail-panel">
      <DetailHeader kind="武将" title={name} tags={tags} onBack={onBack} />

      <AbilityStats warlord={dbInfo} />

      {outcomes.length === 0 ? (
        !dbInfo ? (
          <div className="empty">
            <p className="empty-title">武将が見つかりません</p>
            <p className="empty-hint">
              「{name}」は現在のDB・戦闘履歴のどちらにも見つかりませんでした。
              名前が変更・削除されたか、共有リンクが古い可能性があります。
            </p>
          </div>
        ) : (
          <>
            <div className="empty">
              この武将が登場する戦闘履歴がまだありません。
            </div>
            <WarlordComment name={name} />
          </>
        )
      ) : (
        <>
          <StatCards summary={summary} />
          <WinRateBar summary={summary} />

          <FactionHistory stints={timeline} />

          <MatchupRanking
            ranking={ranking}
            onSelectWarlord={onSelectWarlord}
          />

          <BranchWinRates branches={branches} />

          <WinHeatmapSection heatmap={heatmap} />

          <WarlordComment name={name} />

          <div className="detail-section">
            <h3>使用兵種の割合</h3>
            <div className="pie-block">
              <PieChart data={pieData} />
              <ul className="pie-legend">
                {usage.map((u, i) => {
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
                      {u.name === "不明" ? (
                        <span className="pie-legend-name muted">不明</span>
                      ) : (
                        <button
                          type="button"
                          className="pie-legend-name link-like"
                          onClick={() => onSelectUnit(u.name)}
                          title={`${u.name} の戦績を見る`}
                        >
                          {u.name}
                        </button>
                      )}
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
              currentName={name}
              onSelectWarlord={onSelectWarlord}
              onSelectUnit={onSelectUnit}
            />
          </div>
        </>
      )}
    </section>
  );
}
