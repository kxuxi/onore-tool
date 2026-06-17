"use client";

import { useMemo, useState } from "react";
import type { BattleRecord, WarlordMap } from "@/lib/types";
import {
  collectFactionBattles,
  summarize,
  factionMemberStats,
  branchStats,
  formatWinRate,
} from "@/lib/stats";
import type { FactionMemberStat } from "@/lib/stats";
import {
  factionNameStyle,
  type FactionColorMap,
} from "@/lib/factionColors";
import { BattleLogList } from "@/components/detail/BattleLogList";
import { Section } from "@/components/detail/Section";
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
  colors: FactionColorMap;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
  onBack: () => void;
}

/** 所属武将（現在＋過去に在籍）と、その国での在籍区間の戦績を組み合わせた 1 行分のデータ。 */
interface MemberRow {
  name: string;
  type?: string;
  branch?: string;
  /** その国に在籍していた期間（最後に在籍した区間）の戦績。 */
  stat?: FactionMemberStat;
}

export function FactionDetail({
  name,
  db,
  log,
  colors,
  onSelectWarlord,
  onSelectUnit,
  onBack,
}: Props) {
  // 国全体の戦績（誰がこの国で戦ったかを問わず、この国の旗で戦った全戦闘）。
  const outcomes = useMemo(
    () => collectFactionBattles(log, name),
    [log, name]
  );
  const summary = useMemo(() => summarize(outcomes), [outcomes]);
  const branches = useMemo(() => branchStats(outcomes), [outcomes]);

  // 所属武将：この国で戦ったことのある武将を、在籍していた期間の戦績で表示する。
  const members = useMemo<MemberRow[]>(() => {
    const target = name.trim();
    const statMap = new Map<string, FactionMemberStat>();
    for (const s of factionMemberStats(log, target)) statMap.set(s.name, s);
    const rows: MemberRow[] = Array.from(statMap.keys()).map((n) => {
      const w = db[n];
      return {
        name: n,
        type: w?.type,
        branch: w?.branch,
        stat: statMap.get(n),
      };
    });
    return rows.sort((a, b) => {
      const ab = a.stat?.battles ?? 0;
      const bb = b.stat?.battles ?? 0;
      if (ab !== bb) return bb - ab;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [db, log, name]);

  const tags = (
    <>
      {outcomes.length > 0 && (
        <span className="tag">{outcomes.length}戦</span>
      )}
    </>
  );

  return (
    <section className="panel detail-panel">
      <DetailHeader
        kind="国"
        title={name}
        titleColor={factionNameStyle(name, colors)?.color as string | undefined}
        tags={tags}
        onBack={onBack}
      />

      {outcomes.length === 0 && members.length === 0 ? (
        <div className="empty">
          <p className="empty-title">この国のデータがありません</p>
          <p className="empty-hint">
            「{name}」が登場する戦闘履歴・所属武将が見つかりませんでした。
            「戦闘履歴」タブで戦績を登録すると、勝率や主力兵種がここに表示されます。
          </p>
        </div>
      ) : (
        <>
          {outcomes.length > 0 && (
            <>
              <StatCards summary={summary} />
              <WinRateBar summary={summary} />
            </>
          )}

          <FactionMembers
            members={members}
            onSelectWarlord={onSelectWarlord}
          />

          {outcomes.length > 0 && (
            <>
              <BranchWinRates branches={branches} />

              <Section
                title="戦闘ログ"
                count={`${outcomes.length}件`}
                mobileCollapsed
              >
                <BattleLogList
                  outcomes={outcomes}
                  onSelectWarlord={onSelectWarlord}
                  onSelectUnit={onSelectUnit}
                />
              </Section>
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- 所属武将一覧 ---------- */

/** 所属武将一覧で最初に表示する人数（これを超える分は「もっと見る」で展開）。 */
const INITIAL_MEMBERS = 8;

function FactionMembers({
  members,
  onSelectWarlord,
}: {
  members: MemberRow[];
  onSelectWarlord: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (members.length === 0) return null;
  const shown = expanded ? members : members.slice(0, INITIAL_MEMBERS);
  const hiddenCount = members.length - shown.length;
  return (
    <Section title="所属武将" count={`${members.length}人`} mobileCollapsed>
      <p className="detail-note muted">
        勝率は各武将がこの国に在籍していた期間の戦績です。
      </p>
      <ul className="user-winrate-list">
        {shown.map((m) => {
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
      {members.length > INITIAL_MEMBERS && (
        <div className="show-more-row">
          <button
            type="button"
            className="btn show-more-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "一部だけ表示" : `もっと見る（残り${hiddenCount}人）`}
          </button>
        </div>
      )}
    </Section>
  );
}
