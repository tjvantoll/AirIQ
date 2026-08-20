"use client";

import { fieldDef, seriesColor } from "@/lib/fields";
import type { Point } from "@/lib/series";
import type { RangeKey } from "@/lib/time-ranges";
import { TimeSeriesChart } from "./TimeSeriesChart";

export function AqiChart({ points, rangeKey }: { points: Point[]; rangeKey: RangeKey }) {
  const pm25 = fieldDef("aqi_pm25_us")!;

  return (
    <TimeSeriesChart
      points={points}
      series={[{ key: pm25.key, label: pm25.short, color: seriesColor(pm25.slot) }]}
      unit="AQI"
      rangeKey={rangeKey}
      primaryKey={pm25.key}
      aqiBands
      height={280}
    />
  );
}
