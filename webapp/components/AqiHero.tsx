import { aqiCategory, isAqiSentinel, AQI_SENTINEL } from "@/lib/aqi";
import { formatNumber } from "@/lib/fields";
import { AqiScale } from "./AqiScale";

/**
 * The current headline reading. Deliberately carries no trend — this belongs to
 * the "right now" section, and history lives in its own section below.
 *
 * The numeral stays in ink because the category colors cannot all clear
 * contrast at text sizes; the category is carried by a labelled pill, a colored
 * rail and the scale below, so it never depends on color alone.
 */
export function AqiHero({ value }: { value: number | null }) {
  const sentinel = isAqiSentinel(value);
  const category = aqiCategory(value);

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-line bg-surface"
      aria-labelledby="aqi-hero-heading"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: category?.markVar ?? "var(--border-strong)" }}
      />

      <div className="py-5 pl-7 pr-5">
        <h3
          id="aqi-hero-heading"
          className="text-xs font-medium uppercase tracking-wide text-muted"
        >
          PM2.5 Air Quality Index
        </h3>

        {/* Wide screens put the reading and the scale side by side; narrow
            screens stack them, where a full-width scale still reads well. */}
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="lg:w-[36%] lg:shrink-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {sentinel ? (
                <p className="text-3xl font-semibold text-ink">Out of range</p>
              ) : (
                <p className="tnum text-6xl font-bold leading-none text-ink">
                  {value === null ? "—" : formatNumber(value)}
                </p>
              )}

              {category && (
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold"
                  style={{ color: category.inkVar, borderColor: category.markVar }}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: category.markVar }}
                  />
                  {category.label}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-muted">
              {sentinel
                ? `The sensor reported ${formatNumber(AQI_SENTINEL)}, the library’s marker for a concentration above the top of the EPA scale — not a real index value.`
                : category?.advice}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <AqiScale value={sentinel ? null : value} />
          </div>
        </div>
      </div>
    </section>
  );
}
