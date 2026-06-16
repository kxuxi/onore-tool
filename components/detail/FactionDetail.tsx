"use client";

import { useMemo } from "react";
import type { BattleRecord, WarlordMap } from "@/lib/types";
import {
  collectFactionBattles,
  summarize,
  factionMatchupRanking,
  userWinRates,
  branchStats,
  unitUsage,
  formatWinRate,
} from "@/lib/stats";
import type { OpponentFactionStat, UserWinRate } from "@/lib/stats";
import { PieChart, chartColor } from "@/components/PieChart";
import { BattleLogList } from "@/components/detail/BattleLogList";
import {
  DetailHeader,
  StatCards,
  WinRateBar,
} from "@/components/detail/DetailParts";
import { BranchWinRates } from "@/components/detail/WarlordInsights";

interface Props {
  name: string;
  db: WarlordMap;
  log: BattleRecord[];
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
  onSelectFaction: (name: string) => void;
  onBack: () => void;
}

/** 所属武将（DB 名簿）＋この国での戦績を組み合わせた 1 行分のデータ。 */
interface MemberRow {
  name: string;
  type?: string;
  branch?: string;
  stat?: UserWinRate;
}

export function FactionDetail({
  name,
  db,
  log,
  onSelectWarlord,
  onSelectUnit,
  onSelectFaction,
  onBack,
}: Props) {
  const outcomes = useMemo(
    () => collectFactionBattles(log, name),
    [log, name]
  );
  const summary = useMemo(() => summarize(outcomes), [outcomes]);
  const matchup = useMemo(() => factionMatchupRanking(outcomes), [outcomes]);
  const usage = useMemo(() => unitUsage(outcomes), [outcomes]);
  const branches = useMemo(() => branchStats(outcomes), [outcomes]);

  // 所属武将：DB の名簿（現在この国に所属）を基本に、無ければ戦闘履歴から補完する。
  const members = useMemo<MemberRow[]>(() => {
    const target = name.trim();
    const winMap = new Map<string, UserWinRate>();
    for (const u of userWinRates(outcomes)) winMap.set(u.name, u);

    const roster = Object.values(db).filter(
      (w) => (w.faction ?? "").trim() === target
    );
    const names =
      roster.length > 0
        ? roster.map((w) => w.name)
        : Array.from(winMap.keys());

    const rows = names.map((n) => {
      const w = db[n];
      return {
        name: n,
        type: w?.type,
        branch: w?.branch,
        stat: winMap.get(n),
      };
    });
    // 戦闘数の多い順 → 名前順。戦績の無い武将は後ろへ。
    return rows.sort((a, b) => {
      const ab = a.stat?.battles ?? 0;
      const bb = b.stat?.battles ?? 0;
      if (ab !== bb) return bb - ab;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [db, outcomes, name]);

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
      {members.length > 0 && (
        <span className="tag">{members.length}人</span>
      )}
      {outcomes.length > 0 && (
        <span className="tag">{outcomes.length}戦</span>
      )}
    </>
  );

  return (
    <section className="panel detail-panel">
      <DetailHeader kind="国" title={name} tags={tags} onBack={onBack} />

      {outcomes.length === 0 && members.length === 0 ? (
        <div className="empty">
          <p className="empty-title">この国のデータがありません</p>
          <p className="empty-hint">
            「{name}」が登場する戦闘履歴・所属武将が見つかりませんでした。
            「戦闘履歴」タブで戦績を登録すると、勝率や相性がここに表示されます。
          </p>
        </div>
      ) : (
        <>
          {outcomes.length > 0 && (
            <>
              <StatCards summary={summary} />
              <WinRateBar summary={summary} />

              <FactionMatchupRanking
                best={matchup.best}
                worst={matchup.worst}
                currentFaction={name}
                onSelectFaction={onSelectFaction}
              />
            </>
          )}

          <FactionMembers members={members} onSelectWarlord={onSelectWarlord} />

          {outcomes.length > 0 && (
            <>
              <BranchWinRates branches={branches} />

              {usage.length > 0 && (
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
                              <span className="pie-legend-name muted">
                                不明
                              </span>
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
              )}

              <div className="detail-section">
                <h3>戦闘ログ（{outcomes.length}件）</h3>
                <BattleLogList
                  outcomes={outcomes}
                  onSelectWarlord={onSelectWarlord}
                  onSelectUnit={onSelectUnit}
                />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- 対戦国との相性 ---------- */

function FactionRankRow({
  rank,
  stat,
  onSelectFaction,
}: {
  rank: number;
  stat: OpponentFactionStat;
  onSelectFaction: (name: string) => void;
}) {
  return (
    <li className="rank-row">
      <span className="rank-no">{rank}</span>
      <span className="rank-name">
        <button
          type="button"
          className="link-like"
          onClick={() => onSelectFaction(stat.faction)}
          title={`${stat.faction} の戦績を見る`}
        >
          {stat.faction}
        </button>
      </span>
      <span className="rank-rate">
        {formatWinRate(stat.winRate, stat.decided)}
      </span>
      <span className="rank-record">
        {stat.wins}勝{stat.losses}敗
      </span>
    </li>
  );
}

function FactionMatchupRanking({
  best,
  worst,
  currentFaction,
  onSelectFaction,
}: {
  best: OpponentFactionStat[];
  worst: OpponentFactionStat[];
  currentFaction: string;
  onSelectFaction: (name: string) => void;
}) {
  if (best.length === 0 && worst.length === 0) return null;
  // 自国どうしの対戦（同士討ち）は相性表から除外する。
  const filterSelf = (arr: OpponentFactionStat[]) =>
    arr.filter((s) => s.faction !== currentFaction);
  const bestList = filterSelf(best);
  const worstList = filterSelf(worst);
  if (bestList.length === 0 && worstList.length === 0) return null;
  return (
    <div className="detail-section">
      <h3>対戦国との相性</h3>
      <div className="rank-cols">
        <div className="rank-col">
          <h4 className="rank-head rank-head--good">相性の良い国</h4>
          {bestList.length > 0 ? (
            <ol className="rank-list">
              {bestList.map((s, i) => (
                <FactionRankRow
                  key={s.faction}
                  rank={i + 1}
                  stat={s}
                  onSelectFaction={onSelectFaction}
                />
              ))}
            </ol>
          ) : (
            <p className="muted rank-empty">勝ち越している国はまだありません。</p>
          )}
        </div>
        <div className="rank-col">
          <h4 className="rank-head rank-head--bad">苦手な国</h4>
          {worstList.length > 0 ? (
            <ol className="rank-list">
              {worstList.map((s, i) => (
                <FactionRankRow
                  key={s.faction}
                  rank={i + 1}
                  stat={s}
                  onSelectFaction={onSelectFaction}
                />
              ))}
            </ol>
          ) : (
            <p className="muted rank-empty">負け越している国はまだありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- 所属武将一覧 ---------- */

function FactionMembers({
  members,
  onSelectWarlord,
}: {
  members: MemberRow[];
  onSelectWarlord: (name: string) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="detail-section">
      <h3>所属武将（{members.length}人）</h3>
      <ul className="user-winrate-list">
        {members.map((m) => {
          const s = m.stat;
          const decided = s?.decided ?? 0;
          const pct = decided > 0 ? Math.round((s!.winRate) * 100) : 0;
          return (
            <li key={m.name} className="user-winrate-row">
              <div className="user-winrate-head">
                <button
                  type="button"
                  className="user-winrate-name link-like"
                  onClick={() => onSelectWarlord(m.name)}
                  title={`${m.name} の戦績を見る`}
                >
                  {m.name}
                </button>
                <span className="user-winrate-meta">
                  {s ? (
                    <>
                      <span className="user-winrate-rate">
                        {formatWinRate(s.winRate, s.decided)}
                      </span>
                      <span className="muted">
                        {s.wins}勝{s.losses}敗（{s.battles}戦）
                      </span>
                    </>
                  ) : (
                    <span className="muted">戦績なし</span>
                  )}
                </span>
              </div>
              <span
                className="branch-bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${m.name} の勝率 ${pct}%`}
              >
                <span
                  className="branch-bar-fill"
                  style={{ width: `${decided > 0 ? pct : 0}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
