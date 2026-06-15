"use client";

import { useMemo, useState } from "react";
import type { WarlordMap } from "@/lib/types";
import {
  DEFAULT_WIN_LEFT,
  DEFAULT_WIN_RIGHT,
  FACTION_PALETTE,
  paletteName,
  type FactionColorMap,
} from "@/lib/factionColors";

interface Props {
  db: WarlordMap;
  colors: FactionColorMap;
  onChange: (next: FactionColorMap) => void;
}

export function FactionTab({ db, colors, onChange }: Props) {
  const [openFor, setOpenFor] = useState<string | null>(null);

  const factions = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(db)
            .map((w) => w.faction?.trim())
            .filter((v): v is string => !!v)
        )
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [db]
  );

  const setColor = (faction: string, color: string) => {
    onChange({ ...colors, [faction]: color });
    setOpenFor(null);
  };

  const clearColor = (faction: string) => {
    const next = { ...colors };
    delete next[faction];
    onChange(next);
    setOpenFor(null);
  };

  const resetAll = () => {
    if (!window.confirm("すべての国カラー設定を初期状態（既定色）に戻しますか？")) return;
    onChange({});
    setOpenFor(null);
  };

  const assigned = factions.filter((f) => colors[f]).length;

  return (
    <section className="panel">
      <div className="history-head">
        <h2>国カラー設定</h2>
        <span className="count-badge">
          {assigned} / {factions.length} 設定済
        </span>
        {assigned > 0 && (
          <button
            type="button"
            className="btn"
            onClick={resetAll}
            title="すべての国カラーを既定色に戻します"
          >
            すべてリセット
          </button>
        )}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        国（勢力）ごとに色を設定します。戦闘履歴カードの勝敗ボーダーと勝者名の色に反映されます。
        未設定の国は既定色（左チーム勝利
        <span className="swatch" style={{ background: DEFAULT_WIN_LEFT }} />
        / 右チーム勝利
        <span className="swatch" style={{ background: DEFAULT_WIN_RIGHT }} />）
        で表示されます。
      </p>

      {factions.length === 0 ? (
        <div className="empty">
          登録された国がありません。戦闘履歴を登録すると国が一覧に表示されます。
        </div>
      ) : (
        <div className="faction-color-list">
          {factions.map((f) => {
            const current = colors[f];
            const isSet = !!current;
            const name = paletteName(current);
            return (
              <div className="faction-color-row" key={f}>
                <span className="tag faction">{f}</span>
                <div className="faction-picker">
                  <button
                    type="button"
                    className="color-trigger"
                    onClick={() => setOpenFor((cur) => (cur === f ? null : f))}
                    aria-expanded={openFor === f}
                  >
                    <span
                      className="swatch-lg"
                      style={{ background: current ?? "transparent" }}
                    />
                    <span className={isSet ? "" : "muted"}>
                      {isSet ? name ?? current : "未設定"}
                    </span>
                  </button>

                  {openFor === f && (
                    <div className="palette-pop">
                      <div className="palette-grid">
                        {FACTION_PALETTE.map((c) => (
                          <button
                            type="button"
                            key={c.value}
                            className={
                              "palette-swatch" +
                              (current?.toUpperCase() === c.value.toUpperCase()
                                ? " selected"
                                : "")
                            }
                            style={{ background: c.value }}
                            title={`${c.name} ${c.value}`}
                            aria-label={`${c.name} ${c.value}`}
                            onClick={() => setColor(f, c.value)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {isSet && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => clearColor(f)}
                  >
                    クリア
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {openFor && (
        <div
          className="palette-backdrop"
          onClick={() => setOpenFor(null)}
          aria-hidden
        />
      )}
    </section>
  );
}
