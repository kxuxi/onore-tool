"use client";

import { useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import type { BattleRecord, Warlord } from "@/lib/types";
import { updateWarlordProfile } from "@/lib/api";
import { lookup, householdAliases } from "@/lib/storage";
import { factionBadgeStyle, type FactionColorMap } from "@/lib/factionColors";
import {
  collectWarlordBattles,
  summarize,
  unitUsage,
  latestSelfProfile,
  matchupRanking,
  branchStats,
  winHeatmap,
  factionTimeline,
  type YearRankTag,
} from "@/lib/stats";
import { PieChart, chartColor } from "@/components/PieChart";
import { BattleLogList } from "@/components/detail/BattleLogList";
import { Section } from "@/components/detail/Section";
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
  colors: FactionColorMap;
  /** コメント欄（一言コメント）を表示するか。未ログインでは非表示。 */
  canComment: boolean;
  /** プロフィール編集フォームを表示するか（管理者のみ）。 */
  canEdit?: boolean;
  /** プロフィール更新後に呼ばれる（更新後の全 DB を受け取る）。 */
  onProfileUpdate?: (db: WarlordMap) => void;
  /** 年代別勝率ランキングでの入賞タグ（全期間集計）。 */
  yearRankTags?: YearRankTag[];
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
  onSelectFaction: (name: string) => void;
  onBack: () => void;
}

export function WarlordDetail({
  name,
  db,
  log,
  colors,
  canComment,
  canEdit,
  onProfileUpdate,
  yearRankTags,
  onSelectWarlord,
  onSelectUnit,
  onSelectFaction,
  onBack,
}: Props) {
  const aliases = useMemo(() => householdAliases(db, name), [db, name]);
  const outcomes = useMemo(
    () => collectWarlordBattles(log, name, aliases),
    [log, name, aliases]
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
          style={factionBadgeStyle(faction, colors)}
          onClick={() => onSelectFaction(faction)}
          title={`${faction} の成績を見る`}
        >
          {faction}
        </button>
      )}
      {type && <span className="tag type">{type}</span>}
      {branch && <span className="tag branch">{branch}</span>}
      {yearRankTags?.map((t) => (
        <span
          key={t.bucketKey}
          className={`tag year-rank rank-${t.rank}`}
          title={`${t.label}の勝率ランキング 第${t.rank}位（勝率 ${Math.round(
            t.winRate * 100
          )}% / ${t.wins}勝${t.losses}敗）`}
        >
          {t.label} #{t.rank}
        </span>
      ))}
    </>
  );

  return (
    <section className="panel detail-panel">
      <DetailHeader kind="武将" title={name} tags={tags} onBack={onBack} />

      <AbilityStats warlord={dbInfo} />

      {canEdit && (
        <WarlordProfileEditor
          name={name}
          current={dbInfo ?? null}
          onSaved={(updatedDb) => onProfileUpdate?.(updatedDb)}
        />
      )}

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
            {canComment && <WarlordComment name={name} />}
          </>
        )
      ) : (
        <>
          <StatCards summary={summary} />
          <WinRateBar summary={summary} />

          <FactionHistory stints={timeline} colors={colors} />

          <MatchupRanking
            ranking={ranking}
            colors={colors}
            onSelectWarlord={onSelectWarlord}
          />

          <BranchWinRates branches={branches} />

          <WinHeatmapSection heatmap={heatmap} />

          {canComment && <WarlordComment name={name} />}

          <Section title="使用兵種の割合" mobileCollapsed>
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
                        {u.count.toLocaleString("ja-JP")}戦 ({pct}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Section>

          <Section title="戦闘ログ" count={`${outcomes.length}件`} mobileCollapsed>
            <BattleLogList
              outcomes={outcomes}
              currentName={name}
              onSelectWarlord={onSelectWarlord}
              onSelectUnit={onSelectUnit}
            />
          </Section>
        </>
      )}
    </section>
  );
}

/* ---------- プロフィール編集フォーム（管理者のみ） ---------- */

const TYPE_OPTIONS = ["武特", "統特", "知特", "武統", "統知", "知武", "政治家", "戦闘狂", "謎"];
const BRANCH_OPTIONS = ["騎兵", "歩兵", "弓兵", "万能", "妖怪", "砲兵", "水軍"];

function WarlordProfileEditor({
  name,
  current,
  onSaved,
}: {
  name: string;
  current: Warlord | null;
  onSaved: (db: WarlordMap) => void;
}) {
  const [open, setOpen] = useState(false);
  const [faction, setFaction] = useState(current?.faction ?? "");
  const [type, setType] = useState(current?.type ?? "");
  const [branch, setBranch] = useState(current?.branch ?? "");
  const [unit, setUnit] = useState(current?.unit ?? "");
  const [household, setHousehold] = useState(current?.household ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"idle" | "ok" | "error">("idle");

  const handleSave = async () => {
    if (!type.trim() || !branch.trim()) return;
    setBusy(true);
    setResult("idle");
    try {
      const db = await updateWarlordProfile({
        name,
        faction: faction.trim() || undefined,
        type: type.trim(),
        branch: branch.trim(),
        unit: unit.trim() || undefined,
        household: household.trim() || undefined,
      });
      onSaved(db);
      setResult("ok");
      window.setTimeout(() => setResult("idle"), 2000);
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-editor">
      <button
        type="button"
        className={"btn profile-editor-toggle" + (open ? " active" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "編集を閉じる" : "プロフィールを編集"}
      </button>
      {open && (
        <div className="profile-editor-form">
          <div className="profile-editor-grid">
            <label className="profile-editor-field">
              <span>国</span>
              <input
                type="text"
                className="input"
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
                placeholder="例: 織田"
              />
            </label>
            <label className="profile-editor-field">
              <span>タイプ <span className="required">*</span></span>
              <input
                type="text"
                className="input"
                list="profile-type-list"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="例: 武特"
              />
              <datalist id="profile-type-list">
                {TYPE_OPTIONS.map((v) => <option key={v} value={v} />)}
              </datalist>
            </label>
            <label className="profile-editor-field">
              <span>兵科 <span className="required">*</span></span>
              <input
                type="text"
                className="input"
                list="profile-branch-list"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="例: 騎兵"
              />
              <datalist id="profile-branch-list">
                {BRANCH_OPTIONS.map((v) => <option key={v} value={v} />)}
              </datalist>
            </label>
            <label className="profile-editor-field">
              <span>兵種</span>
              <input
                type="text"
                className="input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="例: 重騎兵"
              />
            </label>
            <label className="profile-editor-field">
              <span>家督名</span>
              <input
                type="text"
                className="input"
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
                placeholder="例: 織田家"
              />
            </label>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={busy || !type.trim() || !branch.trim()}
            >
              {busy ? "保存中…" : "保存する"}
            </button>
            {result === "ok" && (
              <span className="profile-editor-msg ok">保存しました</span>
            )}
            {result === "error" && (
              <span className="profile-editor-msg error">保存に失敗しました</span>
            )}
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            ＊ タイプと兵科は必須です。戦闘履歴より優先して反映されます。
          </p>
        </div>
      )}
    </div>
  );
}
