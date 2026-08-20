import { AqiHero } from "@/components/AqiHero";
import { Card } from "@/components/Card";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { ErrorNotice, SetupNotice } from "@/components/ErrorNotice";
import { SessionTable } from "@/components/SessionTable";
import { StatTile } from "@/components/StatTile";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { AqiChart } from "@/components/charts/AqiChart";
import { MassChart } from "@/components/charts/MassChart";
import { ParticleChart } from "@/components/charts/ParticleChart";
import { SessionCharts } from "@/components/charts/SessionCharts";
import {
  AIR_FIELD_KEYS,
  SESSION_CHART_KEYS,
  fieldDef,
  normalizeAirBody,
  sessionFieldDef,
} from "@/lib/fields";
import {
  NotehubApiError,
  NotehubConfigError,
  fetchAirSamples,
  fetchLatestEvents,
  fetchSessionSamples,
  resolveDevice,
  type LatestEvent,
  type SessionSample,
} from "@/lib/notehub";
import { insertGaps, latestValue, type Point } from "@/lib/series";
import { formatRelative, resolveRange } from "@/lib/time-ranges";

// Every load goes straight to Notehub — nothing here is cached.
export const dynamic = "force-dynamic";

/**
 * The current-conditions panel must never depend on the selected window, or
 * choosing 24h on a quiet day would blank it out. Session telemetry is sparse
 * and irregular, so it is gathered over at least this much history and the most
 * recent non-null value wins.
 */
const CURRENT_TELEMETRY_WINDOW_SEC = 7 * 24 * 60 * 60;

function sessionPoints(samples: SessionSample[]): Point[] {
  return samples.map((sample) => {
    const point: Point = { t: sample.t };
    for (const key of SESSION_CHART_KEYS) {
      const value = sample.fields[key];
      point[key] = typeof value === "number" ? value : null;
    }
    return point;
  });
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const range = resolveRange(params.range);
  const requestedDevice = Array.isArray(params.device) ? params.device[0] : params.device;

  let resolved: Awaited<ReturnType<typeof resolveDevice>> = null;
  let failure: Error | null = null;
  try {
    resolved = await resolveDevice(requestedDevice);
  } catch (error) {
    if (error instanceof NotehubConfigError || error instanceof NotehubApiError) {
      failure = error;
    } else {
      throw error;
    }
  }

  if (failure instanceof NotehubConfigError) return <SetupNotice message={failure.message} />;
  if (failure) return <ErrorNotice title="Could not reach Notehub" message={failure.message} />;

  if (!resolved) {
    return (
      <ErrorNotice
        title="No devices in this project"
        message="Notehub returned no devices for this project UID."
        hint="Check that NOTEHUB_PROJECT_UID points at the project your AirIQ device reports into."
      />
    );
  }

  const { device, all } = resolved;

  // Session telemetry is fetched over the wider of the selected window and the
  // current-conditions window, then sliced for the history charts — one request
  // serves both sections.
  const telemetryStartSec = Math.min(
    range.startSec,
    range.endSec - CURRENT_TELEMETRY_WINDOW_SEC,
  );

  let airSamples: Point[];
  let sessions: SessionSample[];
  let latestEvents: LatestEvent[] = [];
  try {
    [airSamples, sessions, latestEvents] = await Promise.all([
      fetchAirSamples({ deviceUid: device.uid, startSec: range.startSec, endSec: range.endSec }),
      fetchSessionSamples({
        deviceUid: device.uid,
        startSec: telemetryStartSec,
        endSec: range.endSec,
      }),
      fetchLatestEvents(device.uid).catch(() => []),
    ]);
  } catch (error) {
    if (error instanceof NotehubApiError) {
      return <ErrorNotice title="Could not load readings" message={error.message} />;
    }
    throw error;
  }

  /* ------------------------------------------------ current conditions */

  const latestAir = latestEvents.find((event) => event.file === "air.qo");
  // Absent fields mean zero here — see normalizeAirBody.
  const currentAir = latestAir ? normalizeAirBody(latestAir.body) : null;
  const currentAqi = currentAir?.["aqi_pm25_us"] ?? null;
  const airCapturedMs = latestAir?.t ?? null;

  const allSessionPoints = sessionPoints(sessions);
  const currentVoltage = latestValue(allSessionPoints, "voltage");
  const currentRssi = latestValue(allSessionPoints, "rssi");

  const currentMassTiles = (["pm10_env", "pm25_env", "pm100_env"] as const).map((key) => {
    const def = fieldDef(key)!;
    return {
      key,
      label: def.short,
      unit: def.unit,
      value: currentAir?.[key] ?? null,
    };
  });

  /* ---------------------------------------------------------- history */

  const airPoints = insertGaps(airSamples, AIR_FIELD_KEYS);
  const historySessions = sessions.filter((sample) => sample.t >= range.startSec * 1000);
  const historySessionPoints = sessionPoints(historySessions);
  const latestSession = sessions.length ? sessions[sessions.length - 1] : null;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">
          {device.serialNumber || device.bestId || "AirIQ device"}
        </h1>
        <DeviceSwitcher devices={all} selected={device.uid} />
      </div>

      {/* ------------------------------------------------ Current ------ */}
      <section aria-labelledby="current-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="current-heading" className="text-lg font-semibold text-ink">
            Current conditions
          </h2>
          {airCapturedMs && (
            <p className="text-sm text-muted">
              Most recent reading, captured{" "}
              <time dateTime={new Date(airCapturedMs).toISOString()}>
                {formatRelative(airCapturedMs)}
              </time>
            </p>
          )}
        </div>

        {!latestAir && (
          <div className="rounded-xl border border-line bg-surface-alt px-5 py-4 text-sm text-muted">
            Notehub has no <code className="font-mono text-xs">air.qo</code> events on record for
            this device yet.
          </div>
        )}

        <AqiHero value={currentAqi} />

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {currentMassTiles.map((tile) => (
            <StatTile key={tile.key} label={tile.label} value={tile.value} unit={tile.unit} />
          ))}

          <StatTile
            label={sessionFieldDef("voltage").label}
            value={currentVoltage?.value ?? device.voltage ?? null}
            unit="V"
            precision={2}
            note={
              currentVoltage
                ? `Session · ${formatRelative(currentVoltage.t)}`
                : "From the device record"
            }
          />
          <StatTile
            label={sessionFieldDef("rssi").label}
            value={currentRssi?.value ?? null}
            unit="dBm"
            note={currentRssi ? `Session · ${formatRelative(currentRssi.t)}` : undefined}
          />
        </div>
      </section>

      {/* ------------------------------------------------ History ------ */}
      <section aria-labelledby="history-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="history-heading" className="text-lg font-semibold text-ink">
              History
            </h2>
            <p className="text-sm text-muted">
              Last {range.label} · {airSamples.length.toLocaleString()} readings
            </p>
          </div>
          <TimeRangePicker value={range.key} />
        </div>

        {!airSamples.length && (
          <div className="rounded-xl border border-line bg-surface-alt px-5 py-4 text-sm text-muted">
            No <code className="font-mono text-xs">air.qo</code> readings were captured in the last{" "}
            {range.label}. The Notecard syncs on a voltage-dependent schedule — up to 24 hours
            between uploads on a low battery — so try a wider window.
          </div>
        )}

        <Card
          title="PM2.5 Air Quality Index"
          subtitle="US EPA index computed on the device from the PM2.5 environmental concentration. Bands mark the EPA categories."
        >
          <AqiChart points={airPoints} rangeKey={range.key} />
        </Card>

        <Card
          title="Mass concentration"
          subtitle="How much particulate matter is in the air, by size bin."
        >
          <MassChart points={airPoints} rangeKey={range.key} />
        </Card>

        <Card
          title="Particle counts"
          subtitle="Raw particle counts per 0.1 litre of air, by minimum particle size."
        >
          <ParticleChart points={airPoints} rangeKey={range.key} />
        </Card>

        <Card
          title="Connectivity"
          subtitle="Cellular and power telemetry from the device's _session.qo reports."
        >
          <SessionCharts points={historySessionPoints} rangeKey={range.key} />
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">Latest session</h3>
            <SessionTable sample={latestSession} />
          </div>
        </Card>
      </section>
    </div>
  );
}
