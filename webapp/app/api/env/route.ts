import { NextResponse } from "next/server";
import {
  NotehubApiError,
  NotehubConfigError,
  getEnvironmentVariables,
  resolveDevice,
  setEnvironmentVariables,
} from "@/lib/notehub";
import { EDITABLE_VARS, validateSetting } from "@/lib/env-vars";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof NotehubConfigError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (error instanceof NotehubApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

async function deviceUidFor(requested: string | null): Promise<string | null> {
  if (requested) return requested;
  const resolved = await resolveDevice();
  return resolved?.device.uid ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceUid = await deviceUidFor(url.searchParams.get("device"));
    if (!deviceUid) return NextResponse.json({ error: "No device available." }, { status: 404 });
    return NextResponse.json({ variables: await getEnvironmentVariables(deviceUid) });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      device?: string;
      variables?: Record<string, unknown>;
    };

    const variables = payload.variables;
    if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
      return NextResponse.json({ error: "Expected a `variables` object." }, { status: 400 });
    }

    // Only the two settings the app exposes may be written, and the server
    // validates them independently of the browser.
    const clean: Record<string, string> = {};
    for (const [rawName, rawValue] of Object.entries(variables)) {
      const name = rawName.trim();
      if (!EDITABLE_VARS.includes(name)) {
        return NextResponse.json({ error: `${name} is not an editable setting.` }, { status: 400 });
      }
      const result = validateSetting(name, String(rawValue ?? ""));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      clean[name] = result.value;
    }

    if (!Object.keys(clean).length) {
      return NextResponse.json({ error: "No settings supplied." }, { status: 400 });
    }

    const deviceUid = await deviceUidFor(payload.device ?? null);
    if (!deviceUid) return NextResponse.json({ error: "No device available." }, { status: 404 });

    return NextResponse.json({ variables: await setEnvironmentVariables(deviceUid, clean) });
  } catch (error) {
    return fail(error);
  }
}
