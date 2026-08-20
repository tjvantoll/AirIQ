import { formatNumber } from "@/lib/fields";
import type { SeriesSummary } from "@/lib/series";

export function StatTile({
  label,
  value,
  unit,
  precision = 0,
  summary,
  note,
}: {
  label: string;
  value: number | null;
  unit: string;
  precision?: number;
  summary?: SeriesSummary | null;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="tnum text-2xl font-semibold text-ink">
          {value === null ? "—" : formatNumber(value, precision)}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </p>
      {summary ? (
        <p className="tnum mt-1 text-xs text-muted">
          min {formatNumber(summary.min, precision)} · avg{" "}
          {formatNumber(summary.avg, precision)} · max {formatNumber(summary.max, precision)}
        </p>
      ) : (
        note && <p className="mt-1 text-xs text-muted">{note}</p>
      )}
    </div>
  );
}
