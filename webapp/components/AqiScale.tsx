import { AQI_CATEGORIES, aqiCategory } from "@/lib/aqi";

/**
 * The US EPA category scale with a marker for the current reading.
 *
 * Each category gets equal width rather than being plotted linearly across
 * 0-500. This device normally reads well under 50, so on a linear axis the
 * marker would never leave the leftmost tenth and the scale would say nothing.
 * The boundary values are printed at each segment edge, so the non-linearity is
 * visible rather than hidden — the same treatment the EPA's own scale uses.
 *
 * Segments are separated by a surface-colored gap: an edge of background reads
 * harder than a color change alone, especially between the two warm bands.
 *
 * The marker sits in a flex row mirroring the bar's own layout rather than at
 * an absolute percentage of the whole track, so the gaps cannot push it out of
 * alignment with the band it belongs to.
 */
function markerPosition(value: number): { index: number; fraction: number } {
  const found = AQI_CATEGORIES.findIndex((category) => value <= category.max);
  const index = found === -1 ? AQI_CATEGORIES.length - 1 : found;
  const category = AQI_CATEGORIES[index];
  const lower = index === 0 ? 0 : AQI_CATEGORIES[index - 1].max;
  const span = category.max - lower;
  const raw = span > 0 ? (value - lower) / span : 0;
  // Keep the caret from hanging off the ends of its own segment.
  const fraction = Math.min(0.98, Math.max(0.02, raw));
  return { index, fraction };
}

export function AqiScale({ value }: { value: number | null }) {
  const active = aqiCategory(value);
  const marker = value !== null && active ? markerPosition(value) : null;

  return (
    <div
      role="img"
      aria-label={
        active && value !== null
          ? `Air Quality Index ${value} of 500, in the ${active.label} range.`
          : "US EPA Air Quality Index scale. No current reading."
      }
    >
      <div className="flex h-4 gap-[3px]" aria-hidden>
        {AQI_CATEGORIES.map((category, index) => (
          <div key={category.key} className="relative flex-1">
            {marker?.index === index && (
              <span
                className="absolute -translate-x-1/2 text-xs leading-none text-ink"
                style={{ left: `${marker.fraction * 100}%` }}
              >
                ▼
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex h-3.5 gap-[3px]" aria-hidden>
        {AQI_CATEGORIES.map((category) => {
          const isActive = !active || category.key === active.key;
          return (
            <div
              key={category.key}
              className="flex-1 rounded-sm"
              style={{
                background: category.markVar,
                opacity: isActive ? 1 : 0.4,
              }}
            />
          );
        })}
      </div>

      <div className="relative mt-1.5 flex gap-[3px] text-[11px] font-medium text-muted" aria-hidden>
        {AQI_CATEGORIES.map((category, index) => (
          <span key={category.key} className="tnum flex-1">
            {index === 0 ? 0 : category.min}
          </span>
        ))}
        <span className="tnum absolute right-0">500</span>
      </div>
    </div>
  );
}
