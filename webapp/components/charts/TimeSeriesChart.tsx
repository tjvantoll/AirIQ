"use client";

import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AQI_CATEGORIES } from "@/lib/aqi";
import { downsample, latestValue, type Point } from "@/lib/series";
import { axisTimeFormat, type RangeKey } from "@/lib/time-ranges";

export type SeriesSpec = {
  key: string;
  label: string;
  color: string;
};

/** Where a value of 0 is drawn on a log axis, which cannot represent zero. */
const LOG_FLOOR = 0.5;

type Props = {
  points: Point[];
  series: SeriesSpec[];
  unit: string;
  rangeKey: RangeKey;
  /** Field the thinning pass preserves the envelope of. */
  primaryKey?: string;
  yScale?: "linear" | "log";
  /**
   * Override the y-domain. Anchoring at zero suits concentrations and counts,
   * where zero is meaningful, but flattens bounded telemetry — a 4.2-4.4 V
   * supply rail on a 0-8 V axis is a straight line.
   */
  yDomainOverride?: [number | string, number | string];
  /** Draw the US EPA AQI category bands behind the marks. */
  aqiBands?: boolean;
  precision?: number;
  height?: number;
  /**
   * Show a marker per reading. Only honored while the series stays sparse —
   * each dot carries a surface-colored ring, and at high density those rings
   * paint over the line itself.
   */
  dots?: boolean;
  /**
   * Bridge missing values instead of breaking the line. Right for sparse
   * telemetry where a null means "this report omitted the field"; wrong for
   * `air.qo`, where explicit spacers mark real capture gaps.
   */
  connectNulls?: boolean;
};

function formatValue(value: number, precision: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function TimeSeriesChart({
  points,
  series,
  unit,
  rangeKey,
  primaryKey,
  yScale = "linear",
  yDomainOverride,
  aqiBands = false,
  precision = 0,
  height = 260,
  dots = false,
  connectNulls = false,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  const thinned = useMemo(
    () => downsample(points, primaryKey ?? series[0]?.key ?? "t"),
    [points, primaryKey, series],
  );

  const hasZero = useMemo(
    () =>
      yScale === "log" &&
      thinned.some((row) => series.some((s) => row[s.key] === 0)),
    [thinned, series, yScale],
  );

  // A log axis cannot plot 0, so clamp for drawing and keep the true value for
  // the tooltip and the table.
  const data = useMemo(() => {
    if (yScale !== "log") return thinned;
    return thinned.map((row) => {
      const next: Point = { ...row };
      for (const spec of series) {
        const value = row[spec.key];
        if (typeof value === "number") {
          next[`${spec.key}__raw`] = value;
          next[spec.key] = value <= 0 ? LOG_FLOOR : value;
        }
      }
      return next;
    });
  }, [thinned, series, yScale]);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(undefined, axisTimeFormat(rangeKey)),
    [rangeKey],
  );
  const fullFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  /** Above this, per-reading markers hide more than they reveal. */
  const DOT_LIMIT = 40;

  const showDots = useMemo(() => {
    if (!dots) return false;
    const key = primaryKey ?? series[0]?.key;
    if (!key) return false;
    const plotted = data.reduce(
      (count, row) => (typeof row[key] === "number" ? count + 1 : count),
      0,
    );
    return plotted <= DOT_LIMIT;
  }, [dots, data, primaryKey, series]);

  const latest = useMemo(
    () =>
      series.map((spec) => ({
        ...spec,
        latest: latestValue(points, spec.key),
      })),
    [points, series],
  );

  const { maxValue, minValue } = useMemo(() => {
    let max = 0;
    let min = Infinity;
    for (const row of points) {
      for (const spec of series) {
        const value = row[spec.key];
        if (typeof value !== "number") continue;
        if (value > max) max = value;
        if (value < min) min = value;
      }
    }
    return { maxValue: max, minValue: min === Infinity ? 0 : min };
  }, [points, series]);

  // Anchoring at zero is right for counts and concentrations, but wrong for
  // signal metrics like RSSI, which are always negative.
  const yDomain: [number | string, number | string] =
    yDomainOverride ??
    (yScale === "log" ? [LOG_FLOOR, "auto"] : minValue < 0 ? ["auto", "auto"] : [0, "auto"]);

  if (!points.length) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No readings captured in this window.
      </p>
    );
  }

  const visibleBands = aqiBands
    ? AQI_CATEGORIES.filter((category) => category.min <= Math.max(maxValue, 50) + 25)
    : [];

  return (
    <div>
      {/* Identity is never color alone: every series is named here, with its
          latest value, and the table view below repeats it as text. */}
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {latest.map((spec) => (
            <li key={spec.key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: spec.color }}
              />
              <span className="text-muted">{spec.label}</span>
              <span className="tnum font-medium text-ink">
                {spec.latest ? formatValue(spec.latest.value, precision) : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: 320 }}>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />

              {visibleBands.map((category) => (
                <ReferenceArea
                  key={category.key}
                  y1={category.min === 0 ? 0 : category.min - 1}
                  y2={category.max}
                  className="aqi-band"
                  fill={category.markVar}
                  stroke="none"
                  ifOverflow="hidden"
                />
              ))}

              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value: number) => timeFormat.format(value)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={44}
              />
              <YAxis
                width={52}
                scale={yScale}
                domain={yDomain}
                allowDataOverflow={yScale === "log"}
                allowDecimals={precision > 0}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatValue(value, precision)}
              />

              <Tooltip
                isAnimationActive={false}
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as Point | undefined;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
                      <p className="mb-1.5 font-medium text-ink">
                        {fullFormat.format(Number(label))}
                      </p>
                      <ul className="space-y-1">
                        {series.map((spec) => {
                          const raw = row?.[`${spec.key}__raw`];
                          const value =
                            typeof raw === "number" ? raw : (row?.[spec.key] as number | null);
                          return (
                            <li key={spec.key} className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: spec.color }}
                              />
                              <span className="text-muted">{spec.label}</span>
                              <span className="tnum ml-auto pl-3 font-medium text-ink">
                                {typeof value === "number"
                                  ? `${formatValue(value, precision)}${unit ? ` ${unit}` : ""}`
                                  : "no reading"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                }}
              />

              {series.map((spec) => (
                <Line
                  key={spec.key}
                  type="monotone"
                  dataKey={spec.key}
                  name={spec.label}
                  stroke={spec.color}
                  strokeWidth={2}
                  dot={showDots ? { r: 3, strokeWidth: 2, stroke: "var(--surface)" } : false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                  connectNulls={connectNulls}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {hasZero && "Counts of 0 are drawn at the axis floor. "}
          {thinned.length < points.length &&
            `Showing ${thinned.length.toLocaleString()} of ${points.length.toLocaleString()} readings, thinned to preserve peaks. `}
          {unit && `Values in ${unit}.`}
        </p>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
      </div>

      {showTable && (
        <div id={tableId} className="mt-3 max-h-80 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-alt text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Captured
                </th>
                {series.map((spec) => (
                  <th key={spec.key} scope="col" className="px-3 py-2 text-right font-medium">
                    {spec.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((row) => (
                <tr key={row.t} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                    {fullFormat.format(row.t)}
                  </td>
                  {series.map((spec) => {
                    const value = row[spec.key];
                    return (
                      <td key={spec.key} className="tnum px-3 py-1.5 text-right text-ink">
                        {typeof value === "number" ? formatValue(value, precision) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
