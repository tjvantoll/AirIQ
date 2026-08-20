/**
 * Field registry.
 *
 * Every label, unit and series color in the UI resolves through here, so the
 * dashboard, tooltips, legends and table views can never disagree about what a
 * field is called.
 *
 * The `air.qo` set mirrors firmware/src/main.cpp:126-139 exactly. All 14 fields
 * are declared `22` (unsigned 2-byte int) in the note template at
 * firmware/src/config.cpp:47-60, so every value is an integer 0-65535.
 */

export type FieldGroup = "aqi" | "mass-env" | "mass-standard" | "particles";

export type FieldDef = {
  key: string;
  label: string;
  /** Compact label for legends and tight tiles. */
  short: string;
  unit: string;
  group: FieldGroup;
  /** Categorical slot 1-6. Assigned in fixed order, never cycled. */
  slot: number;
  description: string;
};

export const AIR_FIELDS: FieldDef[] = [
  {
    key: "aqi_pm25_us",
    label: "PM2.5 AQI (US)",
    short: "PM2.5 AQI",
    unit: "AQI",
    group: "aqi",
    slot: 1,
    description:
      "US EPA Air Quality Index computed from the PM2.5 environmental concentration.",
  },
  {
    key: "aqi_pm100_us",
    label: "PM10 AQI (US)",
    short: "PM10 AQI",
    unit: "AQI",
    group: "aqi",
    slot: 2,
    description:
      "US EPA Air Quality Index computed from the PM10 environmental concentration.",
  },

  {
    key: "pm10_env",
    label: "PM1.0 concentration",
    short: "PM1.0",
    unit: "µg/m³",
    group: "mass-env",
    slot: 1,
    description: "Particles under 1.0 µm, atmospheric calibration.",
  },
  {
    key: "pm25_env",
    label: "PM2.5 concentration",
    short: "PM2.5",
    unit: "µg/m³",
    group: "mass-env",
    slot: 2,
    description:
      "Particles under 2.5 µm, atmospheric calibration. The headline pollutant.",
  },
  {
    key: "pm100_env",
    label: "PM10 concentration",
    short: "PM10",
    unit: "µg/m³",
    group: "mass-env",
    slot: 3,
    description: "Particles under 10 µm, atmospheric calibration.",
  },

  {
    key: "pm10_standard",
    label: "PM1.0 concentration",
    short: "PM1.0",
    unit: "µg/m³",
    group: "mass-standard",
    slot: 1,
    description: "Particles under 1.0 µm, factory (CF=1) calibration.",
  },
  {
    key: "pm25_standard",
    label: "PM2.5 concentration",
    short: "PM2.5",
    unit: "µg/m³",
    group: "mass-standard",
    slot: 2,
    description: "Particles under 2.5 µm, factory (CF=1) calibration.",
  },
  {
    key: "pm100_standard",
    label: "PM10 concentration",
    short: "PM10",
    unit: "µg/m³",
    group: "mass-standard",
    slot: 3,
    description: "Particles under 10 µm, factory (CF=1) calibration.",
  },

  {
    key: "particles_03um",
    label: "Particles ≥ 0.3 µm",
    short: "≥ 0.3 µm",
    unit: "per 0.1 L",
    group: "particles",
    slot: 1,
    description:
      "Count of particles at least 0.3 µm across, per 0.1 litre of air.",
  },
  {
    key: "particles_05um",
    label: "Particles ≥ 0.5 µm",
    short: "≥ 0.5 µm",
    unit: "per 0.1 L",
    group: "particles",
    slot: 2,
    description:
      "Count of particles at least 0.5 µm across, per 0.1 litre of air.",
  },
  {
    key: "particles_10um",
    label: "Particles ≥ 1.0 µm",
    short: "≥ 1.0 µm",
    unit: "per 0.1 L",
    group: "particles",
    slot: 3,
    description:
      "Count of particles at least 1.0 µm across, per 0.1 litre of air.",
  },
  {
    key: "particles_25um",
    label: "Particles ≥ 2.5 µm",
    short: "≥ 2.5 µm",
    unit: "per 0.1 L",
    group: "particles",
    slot: 4,
    description:
      "Count of particles at least 2.5 µm across, per 0.1 litre of air.",
  },
  {
    key: "particles_50um",
    label: "Particles ≥ 5.0 µm",
    short: "≥ 5.0 µm",
    unit: "per 0.1 L",
    group: "particles",
    slot: 5,
    description:
      "Count of particles at least 5.0 µm across, per 0.1 litre of air.",
  },
  {
    key: "particles_100um",
    label: "Particles ≥ 10 µm",
    short: "≥ 10 µm",
    unit: "per 0.1 L",
    group: "particles",
    slot: 6,
    description:
      "Count of particles at least 10 µm across, per 0.1 litre of air.",
  },
];

export const AIR_FIELD_KEYS = AIR_FIELDS.map((f) => f.key);

const BY_KEY = new Map(AIR_FIELDS.map((f) => [f.key, f]));

export function fieldDef(key: string): FieldDef | undefined {
  return BY_KEY.get(key);
}

/**
 * `air.qo` is published with a fixed `note.template` declaring all 14 fields
 * (firmware/src/config.cpp:42-64), and Notehub omits zero-valued fields when it
 * decodes a templated note. A field missing from the body therefore means
 * zero, not "no reading" — treating it as null would break chart lines at every
 * zero and drop zeros out of the min/avg/max stats.
 *
 * Returns null when the body carries none of the known fields at all, so an
 * unrelated or empty body does not become a row of fabricated zeroes.
 */
export function normalizeAirBody(
  body: Record<string, unknown>,
): Record<string, number> | null {
  const out: Record<string, number> = {};
  let seen = false;

  for (const key of AIR_FIELD_KEYS) {
    const value = body[key];
    if (typeof value === "number" && !Number.isNaN(value)) {
      out[key] = value;
      seen = true;
    }
  }
  if (!seen) return null;

  for (const key of AIR_FIELD_KEYS) {
    if (!(key in out)) out[key] = 0;
  }
  return out;
}

export function fieldsInGroup(group: FieldGroup): FieldDef[] {
  return AIR_FIELDS.filter((f) => f.group === group);
}

export function seriesColor(slot: number): string {
  return `var(--series-${((slot - 1) % 6) + 1})`;
}

/**
 * `_session.qo` telemetry. Notehub attaches some of these at the event's top
 * level and some inside the note body; the UI merges both and renders anything
 * it does not recognise generically, so a Notecard firmware update that adds a
 * field shows up instead of being silently dropped.
 */
export type SessionFieldDef = {
  label: string;
  unit?: string;
  precision?: number;
  /** Charted as its own small multiple when true. */
  chartable?: boolean;
  description?: string;
  /** Rendered as a date rather than a bare number. */
  kind?: "timestamp";
  /**
   * Natural axis range, where the metric has one. Without this these plots
   * anchor at zero, which flattens a narrow-range signal into a straight line.
   */
  domain?: [number | string, number | string];
};

export const SESSION_FIELDS: Record<string, SessionFieldDef> = {
  rssi: {
    label: "Signal strength (RSSI)",
    unit: "dBm",
    precision: 0,
    chartable: true,
    domain: ["auto", "auto"],
    description:
      "Received signal strength. Closer to 0 is stronger; below -100 dBm is weak.",
  },
  sinr: {
    label: "Signal quality (SINR)",
    unit: "dB",
    precision: 0,
    chartable: true,
    domain: ["auto", "auto"],
    description: "Signal to interference-plus-noise ratio. Higher is cleaner.",
  },
  rsrp: { label: "RSRP", unit: "dBm", precision: 0, chartable: true },
  rsrq: { label: "RSRQ", unit: "dB", precision: 0, chartable: true },
  bars: {
    label: "Signal bars",
    unit: "",
    precision: 0,
    chartable: true,
    // The Notecard reports 0-4; a fixed scale keeps a steady signal readable.
    domain: [0, 4],
    description: "Notecard's 0-4 summary of signal quality.",
  },
  voltage: {
    label: "Voltage",
    unit: "V",
    precision: 2,
    chartable: true,
    domain: ["auto", "auto"],
    description: "Supply voltage.",
  },
  temp: { label: "Temperature", unit: "°C", precision: 1, chartable: true },
  secs: { label: "Session length", unit: "s", precision: 0 },
  session_secs: { label: "Session length", unit: "s", precision: 0 },
  rat: { label: "Radio access technology" },
  bearer: { label: "Bearer" },
  band: { label: "Band" },
  apn: { label: "APN" },
  iccid: { label: "SIM ICCID" },
  imsi: { label: "IMSI" },
  modem: { label: "Modem firmware" },
  ip: { label: "IP address" },
  started_because: { label: "Started because" },
  ended_because: { label: "Ended because" },
  orientation: { label: "Orientation" },
  // Notecard reports this as the Unix time of the last detected movement,
  // not a running count.
  moved: { label: "Last moved", kind: "timestamp" },
  rx: { label: "Bytes received", unit: "B", precision: 0 },
  tx: { label: "Bytes sent", unit: "B", precision: 0 },
  tower_id: { label: "Tower ID" },
  tower_country: { label: "Tower country" },
  tower_location: { label: "Tower location" },
  cell: { label: "Cell" },
  continuous: { label: "Continuous mode" },
  power_charging: { label: "Charging" },
  power_usb: { label: "USB power" },
  power_mah: { label: "Power used", unit: "mAh", precision: 1 },
  failed_connects: { label: "Failed connects", precision: 0 },
};

/** Session fields charted as small multiples, in display order. */
export const SESSION_CHART_KEYS = ["rssi", "sinr", "bars", "voltage"] as const;

export function sessionFieldDef(key: string): SessionFieldDef {
  return SESSION_FIELDS[key] ?? { label: humanizeKey(key) };
}

export function humanizeKey(key: string): string {
  return key
    .replace(/^_+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatNumber(value: number, precision = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
