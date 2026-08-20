import { Card } from "@/components/Card";
import { DeviceInfo } from "@/components/DeviceInfo";
import { DeviceSettingsForm } from "@/components/DeviceSettingsForm";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { ErrorNotice, SetupNotice } from "@/components/ErrorNotice";
import {
  DEVICE_NAME_VAR,
  READING_INTERVAL_DEFAULT,
  READING_INTERVAL_VAR,
} from "@/lib/env-vars";
import {
  NotehubApiError,
  NotehubConfigError,
  getEnvironmentVariables,
  resolveDevice,
} from "@/lib/notehub";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const params = await searchParams;
  const requestedDevice = Array.isArray(params.device) ? params.device[0] : params.device;

  let resolved: Awaited<ReturnType<typeof resolveDevice>> = null;
  let variables: Record<string, string> = {};
  let failure: Error | null = null;

  try {
    resolved = await resolveDevice(requestedDevice);
    if (resolved) variables = await getEnvironmentVariables(resolved.device.uid);
  } catch (error) {
    if (error instanceof NotehubConfigError || error instanceof NotehubApiError) {
      resolved = null;
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
        title="No devices found"
        message="There are no AirIQ devices to configure."
      />
    );
  }

  const { device, all } = resolved;

  // When the interval has never been set, the device is running the default
  // compiled into its firmware — so that is the value the form should show.
  const initialInterval = variables[READING_INTERVAL_VAR] ?? String(READING_INTERVAL_DEFAULT);
  const initialName = variables[DEVICE_NAME_VAR] ?? device.serialNumber ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Settings</h1>
          <p className="text-sm text-muted">{initialName || device.uid}</p>
        </div>
        <DeviceSwitcher devices={all} selected={device.uid} />
      </div>

      <Card title="Device settings">
        <DeviceSettingsForm
          deviceUid={device.uid}
          initialName={initialName}
          initialInterval={initialInterval}
        />
      </Card>

      <Card title="Device information">
        <DeviceInfo device={device} />
      </Card>
    </div>
  );
}
