"use client";

import { normalizeDisplayToken } from "@/lib/parser";
import type { BattleOutcome, OutcomeResult } from "@/lib/stats";
import type { BattleSide } from "@/lib/parser";
import { ExternalLinkIcon } from "@/components/icons";

interface Props {
  outcomes: BattleOutcome[];
  /** 強調表示する武将名（武将ページ） */
  currentName?: string;
  /** 強調表示する兵種名（兵種ページ） */
  currentUnit?: string;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
}

function resultLabel(o: BattleOutcome): string {
  if (o.result === "win") return "勝利";
  if (o.result === "loss") return "敗北";
  if (o.card.winner === "retreat") return "撤退";
  if (o.card.winner === "draw") return "引分";
  return "不明";
}

interface ChipProps {
  side: BattleSide;
  currentName?: string;
  currentUnit?: string;
  onSelectWarlord: (name: string) => void;
  onSelectUnit: (name: string) => void;
}

function SideChip({
  side,
  currentName,
  currentUnit,
  onSelectWarlord,
  onSelectUnit,
}: ChipProps) {
  const unit = side.unit ? normalizeDisplayToken(side.unit) : undefined;
  const nameActive = !!currentName && side.name === currentName;
  const unitActive = !!currentUnit && unit === currentUnit;
  return (
    <span className="dl-chip">
      <button
        type="button"
        className={"dl-name" + (nameActive ? " active" : "")}
        onClick={() => onSelectWarlord(side.name)}
        title={`${side.name} の戦績を見る`}
      >
        {side.name}
      </button>
      {unit && (
        <button
          type="button"
          className={"dl-unit" + (unitActive ? " active" : "")}
          onClick={() => onSelectUnit(unit)}
          title={`${unit} の戦績を見る`}
        >
          {unit}
        </button>
      )}
    </span>
  );
}

export function BattleLogList({
  outcomes,
  currentName,
  currentUnit,
  onSelectWarlord,
  onSelectUnit,
}: Props) {
  if (outcomes.length === 0) {
    return <div className="empty">該当する戦闘履歴がありません。</div>;
  }

  return (
    <ul className="detail-log">
      {outcomes.map((o, i) => (
        <li
          key={`${o.record.savedAt}-${i}-${o.side}`}
          className={"dl-row dl-row--" + o.result}
        >
          <span className={"dl-result dl-result--" + o.result}>
            {resultLabel(o)}
          </span>
          <div className="dl-main">
            <div className="dl-meta">
              {o.card.battleAt ?? o.record.time ?? ""}
              {o.card.place ? ` · ${o.card.place}` : ""}
              {o.card.turns ? ` · ${o.card.turns}ターン` : ""}
            </div>
            <div className="dl-match">
              <SideChip
                side={o.self}
                currentName={currentName}
                currentUnit={currentUnit}
                onSelectWarlord={onSelectWarlord}
                onSelectUnit={onSelectUnit}
              />
              <span className="dl-vs">vs</span>
              <SideChip
                side={o.opponent}
                currentName={currentName}
                currentUnit={currentUnit}
                onSelectWarlord={onSelectWarlord}
                onSelectUnit={onSelectUnit}
              />
            </div>
          </div>
          {o.card.url && (
            <a
              className="dl-link"
              href={o.card.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="戦闘ログの詳細を開く"
              title="戦闘ログの詳細を開く"
            >
              <ExternalLinkIcon />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export type { OutcomeResult };
