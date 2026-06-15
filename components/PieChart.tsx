"use client";

/** グラフ用の識別しやすい配色 */
export const CHART_COLORS = [
  "#6AA9FF",
  "#1D9E75",
  "#D85A30",
  "#DDAA00",
  "#9B6BDF",
  "#44AACC",
  "#E0588F",
  "#88BB44",
  "#C0654A",
  "#7788AA",
  "#AA7733",
  "#5FB8A0",
];

export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length];
}

interface Props {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  /** 中央に表示する文字列（省略時は合計値） */
  centerLabel?: string;
}

/**
 * SVG のドーナツ型円グラフ。
 * stroke-dasharray で各セグメントを描画するため arc パス計算は不要。
 */
export function PieChart({
  data,
  size = 168,
  thickness = 30,
  centerLabel,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="円グラフ"
    >
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {total === 0 ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={thickness}
          />
        ) : (
          data.map((d, i) => {
            const len = (d.value / total) * circ;
            const seg = (
              <circle
                key={`${d.label}-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })
        )}
      </g>
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="pie-center-num"
      >
        {centerLabel ?? total}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="pie-center-sub"
      >
        {centerLabel ? "" : "戦"}
      </text>
    </svg>
  );
}
