/**
 * US EPA AQI helpers.
 *
 * The firmware does not compute AQI itself — the Adafruit PM25 AQI library does,
 * inside `read()`, and the result ships in `air.qo` as `aqi_pm25_us` /
 * `aqi_pm100_us`. That library returns a sentinel rather than an error when the
 * concentration is off the top of the EPA table, so anything at or above
 * AQI_SENTINEL is "out of range", not a reading.
 */

export const AQI_SENTINEL = 99999;

export type AqiCategoryKey =
  | "good"
  | "moderate"
  | "usg"
  | "unhealthy"
  | "very-unhealthy"
  | "hazardous";

export type AqiCategory = {
  key: AqiCategoryKey;
  label: string;
  short: string;
  min: number;
  max: number;
  /** Band fill / dot color. */
  markVar: string;
  /** Accessible text step for this category on the current surface. */
  inkVar: string;
  advice: string;
};

export const AQI_CATEGORIES: AqiCategory[] = [
  {
    key: "good",
    label: "Good",
    short: "Good",
    min: 0,
    max: 50,
    markVar: "var(--aqi-good)",
    inkVar: "var(--aqi-good-ink)",
    advice: "Air quality is satisfactory and poses little or no risk.",
  },
  {
    key: "moderate",
    label: "Moderate",
    short: "Moderate",
    min: 51,
    max: 100,
    markVar: "var(--aqi-moderate)",
    inkVar: "var(--aqi-moderate-ink)",
    advice:
      "Acceptable, though unusually sensitive people should consider limiting prolonged exertion outdoors.",
  },
  {
    key: "usg",
    label: "Unhealthy for Sensitive Groups",
    short: "Sensitive",
    min: 101,
    max: 150,
    markVar: "var(--aqi-usg)",
    inkVar: "var(--aqi-usg-ink)",
    advice:
      "People with heart or lung disease, older adults and children should reduce prolonged exertion.",
  },
  {
    key: "unhealthy",
    label: "Unhealthy",
    short: "Unhealthy",
    min: 151,
    max: 200,
    markVar: "var(--aqi-unhealthy)",
    inkVar: "var(--aqi-unhealthy-ink)",
    advice: "Everyone may begin to experience health effects.",
  },
  {
    key: "very-unhealthy",
    label: "Very Unhealthy",
    short: "Very unhealthy",
    min: 201,
    max: 300,
    markVar: "var(--aqi-very-unhealthy)",
    inkVar: "var(--aqi-very-unhealthy-ink)",
    advice: "Health alert — everyone may experience more serious health effects.",
  },
  {
    key: "hazardous",
    label: "Hazardous",
    short: "Hazardous",
    min: 301,
    max: 500,
    markVar: "var(--aqi-hazardous)",
    inkVar: "var(--aqi-hazardous-ink)",
    advice: "Health warning of emergency conditions. Everyone is more likely to be affected.",
  },
];

/** The Adafruit library's out-of-range marker, not a real index. */
export function isAqiSentinel(value: number | null | undefined): boolean {
  return typeof value === "number" && value >= AQI_SENTINEL;
}

export function aqiCategory(value: number | null | undefined): AqiCategory | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (isAqiSentinel(value)) return null;
  for (const category of AQI_CATEGORIES) {
    if (value <= category.max) return category;
  }
  return AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/**
 * EPA piecewise-linear breakpoints for PM2.5 (µg/m³) -> AQI, mirroring what the
 * firmware's sensor library applies. Used only to explain a reading in a
 * tooltip; the charted value always comes from the device.
 */
const PM25_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

export function pm25ToAqi(concentration: number): number | null {
  const c = Math.floor(concentration * 10) / 10;
  for (const [cLow, cHigh, aqiLow, aqiHigh] of PM25_BREAKPOINTS) {
    if (c >= cLow && c <= cHigh) {
      return Math.round(((aqiHigh - aqiLow) / (cHigh - cLow)) * (c - cLow) + aqiLow);
    }
  }
  return null;
}
