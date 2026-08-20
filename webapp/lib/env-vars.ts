/**
 * Device settings, shared by the form and the API route so the browser and the
 * server can never disagree about what is valid.
 *
 * The dashboard exposes exactly two settings. Their Notehub variable names are
 * an implementation detail and never appear in the UI.
 */

/** Notehub uses this reserved variable as the device's serial number / name. */
export const DEVICE_NAME_VAR = "_sn";

/**
 * The only environment variable the AirIQ firmware reads
 * (firmware/src/main.cpp:8). It is fetched with `env.get` on every loop
 * iteration, parsed with `atoi`, and used only when it comes out greater than
 * zero (main.cpp:31-33) — otherwise the firmware falls back to its own default.
 */
export const READING_INTERVAL_VAR = "reading_interval_min";

/** firmware/src/main.cpp:14 — lives in firmware, not in Notehub. */
export const READING_INTERVAL_DEFAULT = 60;

/**
 * The firmware computes `sleepDurationMins * 60` into an int
 * (firmware/src/main.cpp:165), so the product must stay inside a signed 32-bit
 * integer. This leaves generous headroom under that ceiling.
 */
export const READING_INTERVAL_MAX = 35000;

export const DEVICE_NAME_MAX_LENGTH = 60;

/** The only settings this app will write. Anything else is rejected. */
export const EDITABLE_VARS: string[] = [DEVICE_NAME_VAR, READING_INTERVAL_VAR];

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

export function validateDeviceName(raw: string): ValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter a name for this device." };
  if (trimmed.length > DEVICE_NAME_MAX_LENGTH) {
    return { ok: false, error: `Keep the name to ${DEVICE_NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return { ok: false, error: "Names cannot contain line breaks or control characters." };
  }
  return { ok: true, value: trimmed };
}

export function validateReadingInterval(raw: string): ValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter how often the device should take a reading." };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Enter a whole number of minutes." };
  }
  const value = Number(trimmed);
  if (value <= 0) {
    return { ok: false, error: "Enter at least 1 minute." };
  }
  if (value > READING_INTERVAL_MAX) {
    return {
      ok: false,
      error: `Enter ${READING_INTERVAL_MAX.toLocaleString()} minutes or fewer.`,
    };
  }
  return { ok: true, value: String(value) };
}

export function validateSetting(name: string, value: string): ValidationResult {
  if (name === DEVICE_NAME_VAR) return validateDeviceName(value);
  if (name === READING_INTERVAL_VAR) return validateReadingInterval(value);
  return { ok: false, error: "This setting cannot be changed here." };
}
