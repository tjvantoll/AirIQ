"use client";

import { useState } from "react";
import { fieldsInGroup, seriesColor } from "@/lib/fields";
import type { Point } from "@/lib/series";
import type { RangeKey } from "@/lib/time-ranges";
import { ToggleGroup } from "@/components/ToggleGroup";
import { TimeSeriesChart } from "./TimeSeriesChart";

/**
 * The sensor reports each size bin twice: an "environmental" figure calibrated
 * for open air and a "standard" figure using the factory CF=1 calibration.
 * Same unit either way, so one axis and a toggle rather than two charts.
 */
export function MassChart({ points, rangeKey }: { points: Point[]; rangeKey: RangeKey }) {
  const [calibration, setCalibration] = useState<"env" | "standard">("env");
  const fields = fieldsInGroup(calibration === "env" ? "mass-env" : "mass-standard");

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ToggleGroup
          label="Calibration"
          value={calibration}
          onChange={(value) => setCalibration(value as "env" | "standard")}
          options={[
            { value: "env", label: "Environmental" },
            { value: "standard", label: "Standard" },
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
        unit="µg/m³"
        rangeKey={rangeKey}
        primaryKey={calibration === "env" ? "pm25_env" : "pm25_standard"}
      />
      <p className="mt-2 text-xs text-muted">
        {calibration === "env"
          ? "Environmental readings use the atmospheric calibration — the figures to use for real-world air."
          : "Standard readings use the sensor's factory CF=1 calibration, intended for controlled indoor conditions."}
      </p>
    </div>
  );
}
