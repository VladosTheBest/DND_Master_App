export type RailIconName = "brand" | "home" | "quest" | "location" | "player" | "npc" | "monster" | "item" | "event" | "note";

export function RailIcon({ name }: { name: RailIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.75
  };

  switch (name) {
    case "brand":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path
            d="M10 1.8 14.8 5 18.2 10l-3.4 5-4.8 3.2L5.2 15 1.8 10l3.4-5L10 1.8Z"
            fill="url(#rail-brand-gradient)"
            stroke="rgba(248,240,255,.82)"
            strokeWidth="1"
          />
          <path {...common} d="m10 5.6 1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2L10 5.6Z" />
          <defs>
            <linearGradient id="rail-brand-gradient" x1="3" x2="17" y1="2" y2="18">
              <stop offset="0" stopColor="#c38dff" />
              <stop offset="1" stopColor="#6a42f4" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "home":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M3.5 9.2 10 4l6.5 5.2" />
          <path {...common} d="M5.6 8.5v7h8.8v-7" />
        </svg>
      );
    case "quest":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <rect {...common} height="12" rx="2.2" width="12" x="4" y="4" />
          <path {...common} d="M7.2 7.4h5.6M7.2 10h5.6M7.2 12.6h3.4" />
        </svg>
      );
    case "location":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M10 17s4.4-4.7 4.4-8.1A4.4 4.4 0 0 0 10 4.5a4.4 4.4 0 0 0-4.4 4.4C5.6 12.3 10 17 10 17Z" />
          <circle {...common} cx="10" cy="8.9" r="1.6" />
        </svg>
      );
    case "player":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="10" cy="6.8" r="2.4" />
          <path {...common} d="M5.1 15.4c1-2.2 2.7-3.3 4.9-3.3s3.9 1.1 4.9 3.3" />
          <path {...common} d="M15.4 5.6v3.2M13.8 7.2h3.2" />
        </svg>
      );
    case "npc":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="8" cy="7.2" r="2.4" />
          <circle {...common} cx="13.1" cy="8.1" r="1.8" />
          <path {...common} d="M4.5 14.8c.8-2 2.3-3 4.4-3 2 0 3.6 1 4.3 3" />
          <path {...common} d="M11.5 14.5c.5-1.3 1.5-2 2.8-2 1.1 0 2 .5 2.7 1.5" />
        </svg>
      );
    case "monster":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6.2 6.3 4.8 4.6M13.8 6.3l1.4-1.7M6 13.8c1 .8 2.3 1.2 4 1.2 1.7 0 3-.4 4-1.2" />
          <path {...common} d="M5.2 11.6c0-3 2-5.1 4.8-5.1s4.8 2.1 4.8 5.1" />
          <circle cx="8" cy="10.3" fill="currentColor" r="1" />
          <circle cx="12" cy="10.3" fill="currentColor" r="1" />
        </svg>
      );
    case "item":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M4.6 7.1h10.8v8.3H4.6z" />
          <path {...common} d="M7.2 7.1V5.8c0-.9.8-1.7 1.7-1.7h2.2c.9 0 1.7.8 1.7 1.7v1.3" />
          <path {...common} d="M4.6 10.2h10.8" />
        </svg>
      );
    case "event":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <rect {...common} height="11" rx="2.2" width="12" x="4" y="5" />
          <path {...common} d="M7 3.9v2.4M13 3.9v2.4M4 8.3h12" />
        </svg>
      );
    case "note":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6 3.8h6l3 3v9.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 16.2V5.6A1.8 1.8 0 0 1 6.8 3.8Z" />
          <path {...common} d="M12 3.8v3.1h3" />
          <path {...common} d="M7.5 10.2h5M7.5 13h4" />
        </svg>
      );
    default:
      return null;
  }
}

