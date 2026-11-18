import type { CSSProperties } from "react";

export function scoreColor(score: number): string {
  if (score >= 72) return "#34d399";
  if (score >= 52) return "#fbbf24";
  return "#f87171";
}

const TRACK_COLOR = "rgba(148, 163, 184, 0.18)";

/**
 * Circular match-score ring.
 *
 * Rendered as a masked `conic-gradient` instead of an SVG: SVG nodes take part
 * in layout, and the dashboard renders one of these per job card. A background
 * div keeps the cost to a single paint-only element.
 */
export function ScoreGauge({
  score,
  size = 76,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = scoreColor(clamped);
  const thickness = Math.round(size * 0.08 * 10) / 10;

  const ring: CSSProperties = {
    background: `conic-gradient(${color} ${clamped * 3.6}deg, ${TRACK_COLOR} ${clamped * 3.6}deg)`,
    WebkitMaskImage: `radial-gradient(circle closest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px))`,
    maskImage: `radial-gradient(circle closest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px))`,
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative grid h-14 w-14 place-items-center sm:h-[var(--gauge-size)] sm:w-[var(--gauge-size)]"
        style={{ "--gauge-size": `${size}px` } as CSSProperties}
        role="img"
        aria-label={`Match score ${Math.round(clamped)} out of 100`}
      >
        <span
          className="absolute inset-[4%] rounded-full"
          style={ring}
          aria-hidden="true"
        />
        <span
          className="relative text-sm font-semibold tabular-nums sm:text-base"
          style={{ color }}
        >
          {Math.round(clamped)}
        </span>
      </div>
      {label ? (
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      ) : null}
    </div>
  );
}
