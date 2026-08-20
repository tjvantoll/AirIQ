import "server-only";
import * as NotehubJs from "@blues-inc/notehub-js";
import { normalizeAirBody } from "./fields";
import type { Point } from "./series";

/**
 * The only module in the app that talks to Notehub.
 *
 * Everything here runs server-side (`server-only` makes importing it from a
 * client component a build error), so the personal access token never reaches
 * the browser. Callers get plain serializable objects, not SDK model
 * instances, so results can cross the server/client boundary.
 *
 * Note that the SDK's runtime objects are snake_case (`has_more`,
 * `latest_events`) even though its generated docs show camelCase.
 */

const AIR_NOTEFILE = "air.qo";
const SESSION_NOTEFILE = "_session.qo";
/** The API's documented ceiling; one request covers any realistic window here. */
const MAX_PAGE_SIZE = 10000;

export class NotehubConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotehubConfigError";
  }
}

export class NotehubApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "NotehubApiError";
    this.status = status;
  }
}

function config() {
  const pat = process.env.NOTEHUB_PAT?.trim();
  const projectUid = process.env.NOTEHUB_PROJECT_UID?.trim();

  if (!pat) {
    throw new NotehubConfigError(
      "NOTEHUB_PAT is not set. Create a personal access token in Notehub under your user menu → API Access, then add it to webapp/.env.local.",
    );
  }
  if (!projectUid) {
    throw new NotehubConfigError(
      "NOTEHUB_PROJECT_UID is not set. Copy the project UID (app:…) from your Notehub project's Settings page into webapp/.env.local.",
    );
  }
  return { pat, projectUid };
}

/**
 * A fresh client per call. `ApiClient.instance` is a process-wide singleton and
 * setting the token on it mutates state shared by every concurrent request.
 */
function client() {
  const { pat } = config();
  const apiClient = new NotehubJs.ApiClient();
  apiClient.authentications.personalAccessToken.accessToken = pat;
  apiClient.timeout = 30000;
  return apiClient;
}

function projectUid() {
  return config().projectUid;
}

type SdkError = { status?: number; response?: { body?: { message?: string } }; message?: string };

/* The SDK ships no types, so responses are described here at the call sites. */
type DevicesResponse = { devices?: RawDevice[]; has_more?: boolean };
type EventsResponse = { events?: RawEvent[]; has_more?: boolean; through?: string };
type LatestEventsResponse = { latest_events?: RawEvent[] };
type EnvVarsResponse = { environment_variables?: Record<string, unknown> };

async function call<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const err = error as SdkError;
    const status = err?.status;
    const detail = err?.response?.body?.message ?? err?.message ?? "Unknown error";

    if (status === 401 || status === 403) {
      throw new NotehubApiError(
        `Notehub rejected the personal access token (${status}). Check NOTEHUB_PAT — it may be expired, revoked, or lack access to this project.`,
        status,
      );
    }
    if (status === 404) {
      throw new NotehubApiError(
        `Notehub returned 404 for ${what}. Check that NOTEHUB_PROJECT_UID is correct and the device still exists.`,
        status,
      );
    }
    if (status === 429) {
      throw new NotehubApiError(
        "Notehub rate limit reached (429). Wait a moment and reload.",
        status,
      );
    }
    throw new NotehubApiError(`Notehub request failed (${what}): ${detail}`, status);
  }
}

/* ------------------------------------------------------------------ devices */

export type DeviceSummary = {
  uid: string;
  serialNumber: string | null;
  bestId: string | null;
  sku: string | null;
  productUid: string | null;
  firmwareNotecard: string | null;
  firmwareHost: string | null;
  lastActivity: string | null;
  voltage: number | null;
  temperature: number | null;
  location: string | null;
  disabled: boolean;
  provisioned: string | null;
  fleetUids: string[];
};

type RawDevice = Record<string, unknown>;

function toDeviceSummary(device: RawDevice): DeviceSummary {
  const str = (key: string) => {
    const value = device[key];
    return typeof value === "string" && value.length ? value : null;
  };
  const num = (key: string) => {
    const value = device[key];
    return typeof value === "number" && !Number.isNaN(value) ? value : null;
  };
  /**
   * Notehub reports firmware either as an object or as a JSON string holding
   * the same shape. Either way only the version is worth showing — rendering
   * the raw payload dumps a wall of JSON into the table.
   */
  const firmware = (key: string) => {
    let value = device[key] as Record<string, unknown> | string | null | undefined;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (!trimmed.startsWith("{")) return trimmed;
      try {
        value = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return trimmed;
      }
    }

    if (value && typeof value === "object") {
      const version = value["version"];
      if (typeof version === "string" && version.length) return version;
      const target = value["target"];
      if (typeof target === "string" && target.length) return target;
    }
    return null;
  };
  const location = () => {
    for (const key of ["best_location", "gps_location", "triangulated_location", "tower_location"]) {
      const value = device[key] as Record<string, unknown> | undefined;
      const name = value?.["name"];
      if (typeof name === "string" && name.length) return name;
    }
    return null;
  };

  return {
    uid: String(device["uid"] ?? ""),
    serialNumber: str("serial_number"),
    bestId: str("best_id"),
    sku: str("sku"),
    productUid: str("product_uid"),
    firmwareNotecard: firmware("firmware_notecard"),
    firmwareHost: firmware("firmware_host"),
    lastActivity: str("last_activity"),
    voltage: num("voltage"),
    temperature: num("temperature"),
    location: location(),
    disabled: device["disabled"] === true,
    provisioned: str("provisioned"),
    fleetUids: Array.isArray(device["fleet_uids"]) ? (device["fleet_uids"] as string[]) : [],
  };
}

export async function listDevices(): Promise<DeviceSummary[]> {
  const api = new NotehubJs.DeviceApi(client());
  const response = await call<DevicesResponse>("list devices", () =>
    api.getDevices(projectUid(), { pageSize: 500, pageNum: 1 }),
  );
  const devices = response?.devices ?? [];
  return devices.map(toDeviceSummary).filter((d) => d.uid.length > 0);
}

export type ResolvedDevice = {
  device: DeviceSummary;
  all: DeviceSummary[];
};

/**
 * Pick the device to show: an explicit request wins, then NOTEHUB_DEVICE_UID,
 * then the project's first device. The full list comes back too so the UI can
 * offer a picker when the project holds more than one.
 */
export async function resolveDevice(requestedUid?: string): Promise<ResolvedDevice | null> {
  const pinned = process.env.NOTEHUB_DEVICE_UID?.trim();
  const all = await listDevices();
  if (!all.length) return null;

  const wanted = requestedUid?.trim() || pinned;
  const device = (wanted && all.find((d) => d.uid === wanted)) || all[0];
  return { device, all };
}

export async function fetchDevice(deviceUid: string): Promise<DeviceSummary | null> {
  const api = new NotehubJs.DeviceApi(client());
  const response = await call("get device", () => api.getDevice(projectUid(), deviceUid));
  if (!response) return null;
  return toDeviceSummary(response as RawDevice);
}

/* ------------------------------------------------------------------- events */

type RawEvent = Record<string, unknown>;

async function fetchAllEvents(opts: {
  deviceUid: string;
  files: string;
  startSec: number;
  endSec: number;
}): Promise<RawEvent[]> {
  const api = new NotehubJs.EventApi(client());
  const events: RawEvent[] = [];
  let pageNum = 1;

  for (;;) {
    const response = await call<EventsResponse>(`get ${opts.files} events`, () =>
      api.getEvents(projectUid(), {
        pageSize: MAX_PAGE_SIZE,
        pageNum,
        deviceUID: [opts.deviceUid],
        files: opts.files,
        startDate: opts.startSec,
        endDate: opts.endSec,
        dateType: "captured",
        sortBy: "captured",
        sortOrder: "asc",
      }),
    );

    const page = response?.events ?? [];
    events.push(...page);

    if (!response?.has_more || page.length === 0) break;
    pageNum += 1;
    // Backstop against an API that always reports has_more.
    if (pageNum > 50) break;
  }

  return events;
}

function eventTimeMs(event: RawEvent): number | null {
  const whenMs = event["when_ms"];
  if (typeof whenMs === "number" && whenMs > 0) return whenMs;
  const when = event["when"];
  if (typeof when === "number" && when > 0) return when * 1000;
  return null;
}

/**
 * `air.qo` samples, keyed on captured time. Values arrive as unsigned 2-byte
 * integers because of the note template, so no coercion beyond a number check.
 */
export async function fetchAirSamples(opts: {
  deviceUid: string;
  startSec: number;
  endSec: number;
}): Promise<Point[]> {
  const events = await fetchAllEvents({ ...opts, files: AIR_NOTEFILE });
  const points: Point[] = [];

  for (const event of events) {
    const t = eventTimeMs(event);
    if (t === null) continue;
    const values = normalizeAirBody((event["body"] ?? {}) as Record<string, unknown>);
    if (!values) continue;
    points.push({ t, ...values });
  }

  points.sort((a, b) => a.t - b.t);
  return points;
}

export type SessionSample = {
  /** Session start (or the close event's time, for a session opened earlier). */
  t: number;
  endedMs: number | null;
  durationSec: number | null;
  receivedMs: number | null;
  fields: Record<string, string | number | boolean>;
};

/** Event-level telemetry Notehub attaches outside the note body. */
const EVENT_LEVEL_SESSION_KEYS = [
  "bars",
  "rssi",
  "sinr",
  "rsrp",
  "rsrq",
  "rat",
  "temp",
  "voltage",
  "tower_id",
  "tower_country",
  "tower_location",
  "moved",
  "orientation",
];

function flattenEvent(event: RawEvent): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};

  const take = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "number" && Number.isNaN(value)) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  };

  for (const key of EVENT_LEVEL_SESSION_KEYS) take(key, event[key]);

  // Body wins — it is the device's own account of the session.
  const body = (event["body"] ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(body)) take(key, value);

  return out;
}

/**
 * Session fields the dashboard does not surface: `opened` / `closed` mark which
 * half of the pair an event is, and `transport` is invariably "hub" on a
 * session event. They are structure, not telemetry.
 */
const SUPPRESSED_SESSION_KEYS = ["opened", "closed", "transport"];

/**
 * `why` means different things on the two events — why the session started
 * versus why it ended — so it is split rather than letting one overwrite the
 * other during the merge.
 */
function sessionFields(event: RawEvent, role: "open" | "close") {
  const fields = flattenEvent(event);
  for (const key of SUPPRESSED_SESSION_KEYS) delete fields[key];

  const why = fields["why"];
  delete fields["why"];
  if (typeof why === "string" && why.length) {
    fields[role === "open" ? "started_because" : "ended_because"] = why;
  }
  return fields;
}

/**
 * Every session emits exactly two `_session.qo` events — an open and a close,
 * sharing one session UID — and only the open event carries the cellular and
 * power telemetry. Read individually, half the events look empty and the
 * signal history is full of holes, so the pair is merged back into one record.
 */
export async function fetchSessionSamples(opts: {
  deviceUid: string;
  startSec: number;
  endSec: number;
}): Promise<SessionSample[]> {
  const events = await fetchAllEvents({ ...opts, files: SESSION_NOTEFILE });

  type Pair = { open?: RawEvent; close?: RawEvent };
  const bySession = new Map<string, Pair>();

  events.forEach((event, index) => {
    const body = (event["body"] ?? {}) as Record<string, unknown>;
    const role: "open" | "close" = body["closed"] === true ? "close" : "open";
    const uid = event["session"];
    // Without a session UID there is nothing to pair on, so the event stands
    // alone under a key that cannot collide.
    const key = typeof uid === "string" && uid.length ? uid : `orphan:${index}`;

    const pair = bySession.get(key) ?? {};
    pair[role] = event;
    bySession.set(key, pair);
  });

  const samples: SessionSample[] = [];

  for (const { open, close } of bySession.values()) {
    const openedMs = open ? eventTimeMs(open) : null;
    const endedMs = close ? eventTimeMs(close) : null;
    const t = openedMs ?? endedMs;
    if (t === null) continue;

    // Open telemetry wins over anything repeated on the close event.
    const fields = {
      ...(close ? sessionFields(close, "close") : {}),
      ...(open ? sessionFields(open, "open") : {}),
    };

    const received = (open ?? close)?.["received"];

    samples.push({
      t,
      endedMs,
      durationSec:
        openedMs !== null && endedMs !== null && endedMs >= openedMs
          ? Math.round((endedMs - openedMs) / 1000)
          : null,
      receivedMs: typeof received === "number" && received > 0 ? received * 1000 : null,
      fields,
    });
  }

  samples.sort((a, b) => a.t - b.t);
  return samples;
}

export type LatestEvent = {
  file: string;
  t: number | null;
  receivedMs: number | null;
  body: Record<string, unknown>;
  /** Event-level telemetry merged with the note body. */
  telemetry: Record<string, string | number | boolean>;
};

/**
 * The most recent event per notefile. One cheap call that still populates the
 * current-value tiles when the selected window happens to be empty.
 */
export async function fetchLatestEvents(deviceUid: string): Promise<LatestEvent[]> {
  const api = new NotehubJs.DeviceApi(client());
  const response = await call<LatestEventsResponse>("get latest events", () =>
    api.getDeviceLatestEvents(projectUid(), deviceUid),
  );
  const events = response?.latest_events ?? [];

  return events.map((event) => {
    const received = event["received"];
    return {
      file: String(event["file"] ?? ""),
      t: eventTimeMs(event),
      receivedMs: typeof received === "number" && received > 0 ? received * 1000 : null,
      body: (event["body"] ?? {}) as Record<string, unknown>,
      telemetry: flattenEvent(event),
    };
  });
}

/* ---------------------------------------------------- environment variables */

export async function getEnvironmentVariables(deviceUid: string): Promise<Record<string, string>> {
  const api = new NotehubJs.DeviceApi(client());
  const response = await call<EnvVarsResponse>("get environment variables", () =>
    api.getDeviceEnvironmentVariables(projectUid(), deviceUid),
  );
  const vars = response?.environment_variables ?? {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) out[key] = String(value);
  return out;
}

export async function setEnvironmentVariables(
  deviceUid: string,
  variables: Record<string, string>,
): Promise<Record<string, string>> {
  const api = new NotehubJs.DeviceApi(client());
  await call("set environment variables", () =>
    api.setDeviceEnvironmentVariables(projectUid(), deviceUid, {
      environment_variables: variables,
    }),
  );
  return getEnvironmentVariables(deviceUid);
}

