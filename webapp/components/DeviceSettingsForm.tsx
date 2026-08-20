"use client";

import { useState } from "react";
import {
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_NAME_VAR,
  READING_INTERVAL_VAR,
  validateDeviceName,
  validateReadingInterval,
} from "@/lib/env-vars";

type Vars = Record<string, string>;

/**
 * The two settings a person can actually change on an AirIQ. Everything about
 * how they are stored — the Notehub variable names, the scoping rules — stays
 * out of the interface.
 */
export function DeviceSettingsForm({
  deviceUid,
  initialName,
  initialInterval,
}: {
  deviceUid: string;
  initialName: string;
  initialInterval: string;
}) {
  const [name, setName] = useState(initialName);
  const [interval, setIntervalValue] = useState(initialInterval);
  const [saved, setSaved] = useState({ name: initialName, interval: initialInterval });

  const [errors, setErrors] = useState<{ name?: string; interval?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = name !== saved.name || interval !== saved.interval;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setFormError(null);

    const nameResult = validateDeviceName(name);
    const intervalResult = validateReadingInterval(interval);

    const nextErrors = {
      name: nameResult.ok ? undefined : nameResult.error,
      interval: intervalResult.ok ? undefined : intervalResult.error,
    };
    setErrors(nextErrors);
    if (!nameResult.ok || !intervalResult.ok) return;

    // Send only what actually changed, so renaming the device does not also
    // write a reading interval the person never touched.
    const changed: Record<string, string> = {};
    if (nameResult.value !== saved.name) changed[DEVICE_NAME_VAR] = nameResult.value;
    if (intervalResult.value !== saved.interval) {
      changed[READING_INTERVAL_VAR] = intervalResult.value;
    }

    if (!Object.keys(changed).length) {
      setNotice("Nothing to save.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: deviceUid, variables: changed }),
      });
      const payload = (await response.json()) as { variables?: Vars; error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Could not save (${response.status})`);

      const variables = payload.variables ?? {};
      const nextName = variables[DEVICE_NAME_VAR] ?? nameResult.value;
      const nextInterval = variables[READING_INTERVAL_VAR] ?? intervalResult.value;

      setName(nextName);
      setIntervalValue(nextInterval);
      setSaved({ name: nextName, interval: nextInterval });
      setNotice("Settings saved.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label htmlFor="device-name" className="block text-sm font-medium text-ink">
          Device name
        </label>
        <p className="mt-1 text-sm text-muted">The name used to identify this device.</p>
        <input
          id="device-name"
          value={name}
          maxLength={DEVICE_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "device-name-error" : undefined}
          className="mt-2 w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-ink"
        />
        {errors.name && (
          <p id="device-name-error" className="mt-2 text-sm" style={{ color: "var(--aqi-unhealthy-ink)" }}>
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="reading-interval" className="block text-sm font-medium text-ink">
          Reading interval
        </label>
        <p className="mt-1 text-sm text-muted">
          How often the device wakes up to measure air quality.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="reading-interval"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={interval}
            onChange={(event) => setIntervalValue(event.target.value)}
            aria-invalid={errors.interval ? true : undefined}
            aria-describedby={errors.interval ? "reading-interval-error" : undefined}
            className="tnum w-28 rounded-lg border border-line bg-surface px-3 py-2 text-ink"
          />
          <span className="text-sm text-muted">minutes</span>
        </div>
        {errors.interval && (
          <p
            id="reading-interval-error"
            className="mt-2 text-sm"
            style={{ color: "var(--aqi-unhealthy-ink)" }}
          >
            {errors.interval}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-[var(--primary-contrast)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {formError ? (
          <p role="alert" className="text-sm" style={{ color: "var(--aqi-unhealthy-ink)" }}>
            {formError}
          </p>
        ) : (
          notice && (
            <p role="status" className="text-sm" style={{ color: "var(--aqi-good-ink)" }}>
              {notice}
            </p>
          )
        )}
      </div>

      <p className="text-sm text-muted">
        Changes are saved right away, but the device only picks them up the next time it connects —
        usually within an hour while it has power from USB or strong sun, and up to a day on a low
        battery.
      </p>
    </form>
  );
}
