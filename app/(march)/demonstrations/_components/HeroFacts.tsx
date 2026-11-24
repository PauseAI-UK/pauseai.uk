import type { March } from "@/lib/content/march";
import { m } from "./classes";

/**
 * A march's when and where, as its hero gives them: the date and time, and
 * the city, with its route once that's settled. For a march that's `past`,
 * the date is labelled as when it took place.
 */
export default function HeroFacts({ march, past = false }: { march: March; past?: boolean }) {
  return (
    <div className={m("hero-facts")}>
      <div className={m("hero-fact")}>
        <Icon name="calendar" />
        <div>
          {past && <p className={m("hero-fact-label")}>Took place</p>}
          <p className={m("hero-fact-words")}>
            <time dateTime={march.dateIso}>{march.dateLong}</time>
            <br />
            {march.time}
          </p>
        </div>
      </div>
      <div className={m("hero-fact")}>
        <Icon name="map-pin" />
        <p className={m("hero-fact-words")}>
          {march.city}
          {march.route && (
            <>
              <br />
              <span className={m("hero-route")}>
                {march.route.start.name}
                <Icon name="arrow-right" label="to" />
                {march.route.end.name}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Lucide's icons, as the site's own are: thin strokes in the text's colour. */
function Icon({ name, label }: { name: keyof typeof ICONS; label?: string }) {
  return (
    <svg
      className={m(name === "arrow-right" ? "hero-route-arrow" : "hero-icon")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
};
