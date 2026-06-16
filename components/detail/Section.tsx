"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "@/components/icons";
import { MOBILE_QUERY } from "@/lib/useIsMobile";

interface SectionProps {
  title: ReactNode;
  /** 見出し横に小さく表示する件数（例: 戦闘数・人数）。 */
  count?: number | string;
  /** 開閉状態の初期値を明示指定する（指定時は mobileCollapsed より優先）。 */
  defaultOpen?: boolean;
  /** モバイル幅では既定で畳んでおく（縦長を抑える）。 */
  mobileCollapsed?: boolean;
  children: ReactNode;
}

/** 初期の開閉状態を同期的に決める（詳細はハイドレーション後にマウントされるため安全）。 */
function computeInitialOpen(
  defaultOpen: boolean | undefined,
  mobileCollapsed: boolean | undefined
): boolean {
  if (defaultOpen != null) return defaultOpen;
  if (
    mobileCollapsed &&
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia(MOBILE_QUERY).matches
  ) {
    return false;
  }
  return true;
}

/**
 * 詳細ページの折りたたみ可能なセクション。見出しがトグルボタンになり、
 * 本文の表示/非表示を切り替える。モバイルでは指定により既定で畳める。
 */
export function Section({
  title,
  count,
  defaultOpen,
  mobileCollapsed,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(() =>
    computeInitialOpen(defaultOpen, mobileCollapsed)
  );
  const bodyId = useId();
  return (
    <section className="detail-section">
      <h3 className="section-head">
        <button
          type="button"
          className="section-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="section-toggle-title">
            {title}
            {count != null && <span className="section-count">{count}</span>}
          </span>
          <span className="section-toggle-icon" aria-hidden="true">
            {open ? <ChevronUp /> : <ChevronDown />}
          </span>
        </button>
      </h3>
      <div id={bodyId} className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
