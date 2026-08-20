"use client";

import { SESSION_CHART_KEYS, sessionFieldDef } from "@/lib/fields";
import type { Point } from "@/lib/series";
import type { RangeKey } from "@/lib/time-ranges";
import { TimeSeriesChart } from "./TimeSeriesChart";

export type SessionPoint = Point;

/**
 * Small multiples rather than one chart with several axes: RSSI in dBm, SINR in
 * dB, bars 0-4 and volts share no scale, and stacking them on one plot with two
 * y-axes would misrepresent every crossing.
 */
export function SessionCharts({
  points,
  rangeKey,
}: {
  points: SessionPoint[];
  rangeKey: RangeKey;
}) {
  const available = SESSION_CHART_KEYS.filter((key) =>
    points.some((point) => typeof point[key] === "number"),
  );

  if (!available.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No connectivity telemetry in this window.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {available.map((key) => {
        const def = sessionFieldDef(key);
        return (
          <div key={key}>
            <h3 className="text-sm font-semibold text-ink">{def.label}</h3>
            {def.description && <p className="mt-0.5 text-xs text-muted">{def.description}</p>}
            <div className="mt-2">
              <TimeSeriesChart
                points={points}
                series={[{ key, label: def.label, color: "var(--series-1)" }]}
                unit={def.unit ?? ""}
                rangeKey={rangeKey}
                primaryKey={key}
                precision={def.precision ?? 0}
                yDomainOverride={def.domain}
                height={170}
                dots
                connectNulls
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
