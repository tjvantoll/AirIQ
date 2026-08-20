# AirIQ web dashboard

A Next.js dashboard for the AirIQ air quality monitor. It reads `air.qo` and
`_session.qo` events from [Blues Notehub](https://notehub.io), charts them over
time, and lets you rename the device and change how often it takes a reading.

## Setup

1. **Create a Notehub personal access token.** Sign in at
   [notehub.io](https://notehub.io) → user menu (top right) → **API Access** →
   **Create New Token**. Copy the token; it is only shown once.
2. **Find your project UID.** It is on the Notehub project's Settings page and
   looks like `app:00000000-0000-0000-0000-000000000000`.
3. **Configure the app.**

   ```bash
   cp .env.local.example .env.local
   # then fill in NOTEHUB_PAT and NOTEHUB_PROJECT_UID
   ```

4. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `NOTEHUB_PAT` | yes | Notehub personal access token, sent as a bearer token |
| `NOTEHUB_PROJECT_UID` | yes | Project to read from, e.g. `app:…` |
| `NOTEHUB_DEVICE_UID` | no | Pin the dashboard to one device instead of auto-selecting |

The token is only ever read in server code — `lib/notehub.ts` imports
`server-only`, so importing it from a client component fails the build.

## What the dashboard shows

The device publishes 14 fields in `air.qo`, all unsigned 2-byte integers
(see the `note.template` request in `firmware/src/config.cpp`):

| Field | Unit | Meaning |
|---|---|---|
| `aqi_pm25_us` | AQI | **US EPA index from PM2.5** — the headline reading |
| `aqi_pm100_us` | AQI | US EPA index from PM10 |
| `pm10_env` / `pm25_env` / `pm100_env` | µg/m³ | Mass concentration, atmospheric calibration |
| `pm10_standard` / `pm25_standard` / `pm100_standard` | µg/m³ | Mass concentration, factory CF=1 calibration |
| `particles_03um` … `particles_100um` | per 0.1 L | Particle counts by minimum size, six bins |

Three device behaviors shape how this is presented:

- **Readings are plotted on capture time, never upload time.** The Notecard runs
  in `periodic` mode with voltage-dependent sync intervals, so a batch of
  readings captured hours apart can arrive in one upload. A gap in *receipt* is
  not downtime.
- **`99999` is not an AQI.** It is the sensor library's marker for a
  concentration above the top of the EPA scale, and the dashboard shows it as
  "Out of range" rather than plotting a spike.
- **A field missing from `air.qo` means zero.** Notehub omits zero-valued fields
  when it decodes a templated note, so a body can arrive as
  `{"aqi_pm25_us":4,"pm25_env":1,…}` with `pm10_env` simply absent. Because the
  firmware declares all 14 fields in its `note.template` on every boot, absence
  is provably zero — `normalizeAirBody()` in `lib/fields.ts` fills it in.
  Treating it as null instead breaks chart lines at every zero and drops zeros
  out of the min/avg/max stats.

The dashboard is split in two: **Current conditions** reads the device's latest
events and is deliberately independent of the range picker, so it never blanks
out on a quiet day; **History** owns the range picker and all the charts.

## Settings

The settings page is a product surface, not a Notehub console: it exposes two
settings and nothing about how they are stored.

| Setting | Backed by | Notes |
|---|---|---|
| Device name | the `_sn` environment variable | Notehub's reserved serial-number variable |
| Reading interval | `reading_interval_min` | The only variable the firmware reads; defaults to 60 minutes in firmware when unset |

`lib/env-vars.ts` holds the validation rules and the allowlist of writable
variables; `app/api/env/route.ts` rejects anything outside it, so the API cannot
be used to set arbitrary environment variables.

Changes save to Notehub immediately but only reach the device on its next
inbound sync — within an hour on USB power, up to 24 hours on battery.

## Notes

- `@blues-inc/notehub-js` is CommonJS and ships no TypeScript types; `types/notehub-js.d.ts`
  declares the module and `lib/notehub.ts` is the only file allowed to import it.
- The SDK's runtime objects are snake_case (`has_more`, `latest_events`) even
  though its generated docs show camelCase.
- Nothing is cached. Every page load queries Notehub live.
- Chart series colors are validated for colorblind separation and contrast in
  both light and dark mode; they are deliberately not the logo's blues, which
  failed those checks. Brand color is carried by the chrome and the AQI ramp.
- The AQI scale on the dashboard gives each EPA category equal width rather than
  plotting 0-500 linearly. This device normally reads well under 50, where a
  linear axis would pin the marker to the left edge; the boundary values are
  printed at each segment edge so the non-linearity is visible, not hidden.
- Per-reading dots are drawn only while a series stays sparse. Each marker
  carries a surface-colored ring, and at high density those rings paint over the
  line itself.
