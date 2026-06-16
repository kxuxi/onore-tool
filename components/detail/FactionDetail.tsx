"use client";

import { useMemo, useState } from "react";
import type { BattleRecord, WarlordMap } from "@/lib/types";
import {
  collectFactionBattles,
  summarize,
  factionMemberStats,
  latestUnitsByBranch,
  branchStats,
  formatWinRate,
} from "@/lib/stats";
import type { FactionMemberStat, BranchLatestUnits } from "@/lib/stats";
import { copyText } from "@/lib/clipboard";
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
  onBack: () => void;
}

/** 所属武将（現在＋過去に在籍）と、その国での在籍区間の戦績を組み合わせた 1 行分のデータ。 */
interface MemberRow {
  name: string;
  type?: string;
  branch?: string;
  /** その国に在籍していた期間（最後に在籍した区間）の戦績。 */
  stat?: FactionMemberStat;
  /** 現在もこの国に所属しているか（DB 名簿基準）。 */
  current: boolean;
  /** 現在は他国にいる場合の所属先（過去在籍者の参考表示用）。 */
  currentFaction?: string;
}

export function FactionDetail({
  name,
  db,
  log,
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

  // 所属武将：現在この国に居る武将に加え、過去に在籍して他国へ移った武将も、
  // その国に在籍していた期間（最後に在籍した区間）の戦績で表示する。
  // これにより、滅亡・縮小した国でも過去の所属武将の成績が反映される。
  const members = useMemo<MemberRow[]>(() => {
    const target = name.trim();
    const statMap = new Map<string, FactionMemberStat>();
    for (const s of factionMemberStats(log, target)) statMap.set(s.name, s);

    // 現在この国に所属している武将（DB 名簿）の名前。
    const currentNames = new Set(
      Object.values(db)
        .filter((w) => (w.faction ?? "").trim() === target)
        .map((w) => w.name)
    );

    // 表示対象 = 現名簿 ∪ その国で戦ったことのある武将（過去に抜けた武将を含む）。
    const names = new Set<string>([...currentNames, ...statMap.keys()]);

    const rows: MemberRow[] = Array.from(names).map((n) => {
      const w = db[n];
      const current = currentNames.has(n);
      return {
        name: n,
        type: w?.type,
        branch: w?.branch,
        stat: statMap.get(n),
        current,
        currentFaction: !current ? w?.faction?.trim() || undefined : undefined,
      };
    });
    // 現所属を先頭に、次に在籍期間の戦闘数の多い順 → 名前順。
    return rows.sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      const ab = a.stat?.battles ?? 0;
      const bb = b.stat?.battles ?? 0;
      if (ab !== bb) return bb - ab;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [db, log, name]);

  // 現在この国に所属している人数（DB 名簿基準。国一覧の「人数」と一致）。
  const currentCount = useMemo(
    () => members.filter((m) => m.current).length,
    [members]
  );

  // 現在の主力兵種：いま所属している武将が最新で使っている兵種を兵科ごとにまとめる。
  // （過去に在籍して抜けた武将は「現在の」主力ではないため対象外。）
  const latestUnits = useMemo<BranchLatestUnits[]>(() => {
    const stats = members
      .filter((m) => m.current)
      .map((m) => m.stat)
      .filter((s): s is FactionMemberStat => !!s);
    return latestUnitsByBranch(stats);
  }, [members]);

  const tags = (
    <>
      {currentCount > 0 && <span className="tag">{currentCount}人</span>}
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

          <LatestUnits groups={latestUnits} onSelectUnit={onSelectUnit} />

          <FactionMembers
            members={members}
            currentCount={currentCount}
            onSelectWarlord={onSelectWarlord}
          />

          {outcomes.length > 0 && (
            <>
              <BranchWinRates branches={branches} />

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

/* ---------- 現在の主力兵種（所属武将の最新使用兵種） ---------- */

function LatestUnits({
  groups,
  onSelectUnit,
}: {
  groups: BranchLatestUnits[];
  onSelectUnit: (name: string) => void;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  // 国へ報告するための主力兵種テキスト。兵科ごとに 1 行で「兵種: 人数」を並べる。
  const reportText = useMemo(
    () =>
      groups
        .map(
          (g) =>
            `【${g.branch}】` +
            g.units.map((u) => `${u.unit}: ${u.count}`).join(", ")
        )
        .join("\n"),
    [groups]
  );

  const handleCopy = async () => {
    if (!reportText) return;
    const ok = await copyText(reportText);
    setCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setCopied("idle"), 1800);
  };

  if (groups.length === 0) return null;
  const memberTotal = groups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="detail-section">
      <h3>現在の主力兵種</h3>
      <p className="detail-note muted">
        所属武将が最後の出陣で使っていた兵種を、兵科ごとに集計しています（数字は人数）。
      </p>
      <ul className="latest-units">
        {groups.map((g) => (
          <li key={g.branch} className="latest-units-row">
            <span className="latest-units-branch">
              {g.branch}
              <span className="latest-units-total">{g.total}</span>
            </span>
            <span className="latest-units-units">
              {g.units.map((u) => (
                <button
                  key={u.unit}
                  type="button"
                  className="latest-unit-chip"
                  onClick={() => onSelectUnit(u.unit)}
                  title={`${u.unit} の戦績を見る`}
                >
                  <span className="latest-unit-name">{u.unit}</span>
                  <span className="latest-unit-count">{u.count}</span>
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <div className="scout-report">
        <div className="scout-report-head">
          <span className="scout-report-title">
            報告用テキスト（兵科｜兵種: 人数）
            <span className="scout-report-count">{memberTotal}人</span>
          </span>
          <button
            type="button"
            className="btn"
            onClick={handleCopy}
            disabled={!reportText}
          >
            {copied === "ok"
              ? "コピーしました"
              : copied === "fail"
                ? "コピーできませんでした"
                : "報告用をコピー"}
          </button>
        </div>
        <textarea
          className="scout-report-text"
          readOnly
          value={reportText}
          rows={Math.min(groups.length + 1, 8)}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  );
}

/* ---------- 所属武将一覧 ---------- */

function FactionMembers({
  members,
  currentCount,
  onSelectWarlord,
}: {
  members: MemberRow[];
  currentCount: number;
  onSelectWarlord: (name: string) => void;
}) {
  if (members.length === 0) return null;
  const pastCount = members.length - currentCount;
  return (
    <div className="detail-section">
      <h3>所属武将（{members.length}人）</h3>
      <p className="detail-note muted">
        勝率は各武将がこの国に在籍していた期間の戦績です。
        {pastCount > 0
          ? `現在の所属は${currentCount}人で、ほかの${pastCount}人は過去に在籍した武将です（他国へ移った武将も在籍当時の成績で表示します）。`
          : ""}
      </p>
      <ul className="user-winrate-list">
        {members.map((m) => {
          const s = m.stat;
          const decided = s?.decided ?? 0;
          const pct = decided > 0 ? Math.round((s!.winRate) * 100) : 0;
          return (
            <li key={m.name} className="user-winrate-row">
              <div className="user-winrate-head">
                <span className="user-winrate-name-wrap">
                  <button
                    type="button"
                    className="user-winrate-name link-like"
                    onClick={() => onSelectWarlord(m.name)}
                    title={`${m.name} の戦績を見る`}
                  >
                    {m.name}
                  </button>
                  {!m.current && (
                    <span
                      className="member-left-tag"
                      title={
                        m.currentFaction
                          ? `現在は「${m.currentFaction}」に所属`
                          : "現在はこの国に所属していません"
                      }
                    >
                      {m.currentFaction ? `現 ${m.currentFaction}` : "元所属"}
                    </span>
                  )}
                </span>
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
