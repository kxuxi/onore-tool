/**
 * 共通アイコン。各コンポーネントでコピペ重複していた SVG をここに集約する。
 * すべて currentColor 基準・className="icon"・aria-hidden（装飾目的）で統一。
 * ボタン/リンク側で aria-label を付与する前提。
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SearchIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function FilterIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function TrophyIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
    </svg>
  );
}

export function ChevronLeft({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRight({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function ChevronUp({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function ExternalLinkIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function CopyIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ShareIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function SortIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="12" x2="12" y2="12" />
      <line x1="4" y1="18" x2="8" y2="18" />
      <path d="M18 9V20M18 20l-3-3M18 20l3-3" />
    </svg>
  );
}

export function CloseIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CheckIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function RefreshIcon({ className = "icon" }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}
