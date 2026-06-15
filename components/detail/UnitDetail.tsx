"use client";

import { useMemo } from "react";
import type { BattleRecord } from "@/lib/types";
import {
  collectUnitBattles,
  summarize,
  unitMatchupRanking,
  userWinRates,
  unitUsageTrend,
  unitBranchLabel,
} from "@/lib/stats";
import { BattleLogList } from "@/components/detail/BattleLogList";
import {
  DetailHeader,
  StatCards,
  WinRateBar,
} from "@/components/detail/DetailParts";
import {
  UnitMatchupRanking,
  UserWinRateList,
  UsageTrend,
} from "@/components/detail/UnitInsights";

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

  const branch = useMemo(() => unitBranchLabel(outcomes), [outcomes]);
  const unitRanking = useMemo(
    () => unitMatchupRanking(outcomes),
    [outcomes]
  );
  const users = useMemo(() => userWinRates(outcomes), [outcomes]);
  const trend = useMemo(() => unitUsageTrend(log, name), [log, name]);

  return (
    <section className="panel detail-panel">
      <DetailHeader
        kind="兵種"
        title={name}
        tags={
          branch ? <span className="tag branch">{branch}</span> : undefined
        }
        onBack={onBack}
      />

      {outcomes.length === 0 ? (
        <div className="empty">
          <p className="empty-title">この兵種の戦闘データがありません</p>
          <p className="empty-hint">
            「{name}」が使われた戦闘履歴が見つかりませんでした。
            兵種名が変更・削除されたか、共有リンクが古い可能性があります。
            「戦闘履歴」タブで戦績を登録すると、勝率や相性がここに表示されます。
          </p>
        </div>
      ) : (
        <>
          <StatCards summary={summary} />
          <WinRateBar summary={summary} />

          <UnitMatchupRanking
            ranking={unitRanking}
            onSelectUnit={onSelectUnit}
          />

          <UserWinRateList users={users} onSelectWarlord={onSelectWarlord} />

          <UsageTrend points={trend} />

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
