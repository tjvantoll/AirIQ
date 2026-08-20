/**
 * The AirIQ mark, redrawn as SVG.
 *
 * logo.png is a 200px raster with an opaque cream background, which would show
 * a visible box on any surface and cannot theme. This keeps the circular
 * gradient and the three wave cutouts, and lets the wordmark inherit `currentColor`.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="AirIQ"
      className={className}
    >
      <defs>
        <linearGradient id="airiq-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A90CF" />
          <stop offset="50%" stopColor="#3084C2" />
          <stop offset="100%" stopColor="#2C5FA6" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#airiq-mark)" />
      <g
        fill="none"
        stroke="#FFFDF5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      >
        <path d="M32 36 C40 29 47 43 55 36 C60 32 66 33 70 36" strokeWidth="5.5" />
        <path d="M24 52 C34 43 44 61 54 52 C62 45 70 46 76 50" strokeWidth="6.5" />
        <path d="M32 68 C40 61 47 75 55 68 C59 64 65 64 69 67" strokeWidth="5.5" />
      </g>
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.35rem] font-extrabold tracking-tight text-ink">AirIQ</span>
    </span>
  );
}
