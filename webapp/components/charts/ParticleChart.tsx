"use client";

import { useState } from "react";
import { fieldsInGroup, seriesColor } from "@/lib/fields";
import type { Point } from "@/lib/series";
import type { RangeKey } from "@/lib/time-ranges";
import { ToggleGroup } from "@/components/ToggleGroup";
import { TimeSeriesChart } from "./TimeSeriesChart";

/**
 * The six size bins span orders of magnitude — the 0.3 µm count routinely runs
 * a thousand times the 10 µm count — so this defaults to a log axis, where all
 * six stay legible at once.
 */
export function ParticleChart({ points, rangeKey }: { points: Point[]; rangeKey: RangeKey }) {
  const [scale, setScale] = useState<"log" | "linear">("log");
  const fields = fieldsInGroup("particles");

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ToggleGroup
          label="Scale"
          value={scale}
          onChange={(value) => setScale(value as "log" | "linear")}
          options={[
            { value: "log", label: "Log" },
            { value: "linear", label: "Linear" },
          ]}
        />
      </div>
      <TimeSeriesChart
        points={points}
        series={fields.map((field) => ({
          key: field.key,
          label: field.short,
          color: seriesColor(field.slot),
        }))}
        unit="per 0.1 L"
        rangeKey={rangeKey}
        primaryKey="particles_03um"
        yScale={scale}
        height={300}
      />
    </div>
  );
}
