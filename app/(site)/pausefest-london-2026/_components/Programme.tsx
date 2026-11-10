import Image from "next/image";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import type { FestDay, FestEvent } from "@/lib/content/pausefest";
import type { EventGoing } from "@/lib/going";
import Going from "./Going";
import styles from "./Programme.module.css";

/** Where to register: the march's own sign-up, a page of ours, or Luma, in a new tab. */
function linkProps(href: string) {
  return href.startsWith("/") ? { internal: true } : { internal: false, target: "_blank", rel: "noreferrer" };
}

/**
 * A featured event's black band, in the rows' three columns: the day and
 * time, the name large with where and the links under it, and the cover
 * where the poster has a QR code.
 */
function Featured({ day, event, going }: { day: FestDay; event: FestEvent; going?: EventGoing | null }) {
  const { internal, ...external } = linkProps(event.href);
  return (
    <li className={styles.featured}>
      <div className={`container ${styles.columns}`}>
        <p className={styles.featuredWhen}>
          {day.short}
          <br />
          {event.time}
        </p>
        <div>
          <h3 className={styles.featuredTitle}>{event.title}</h3>
          <p className={styles.featuredPlace}>{event.place}</p>
          {going && <Going going={going} />}
          <div className={styles.actions}>
            {internal ? (
              <ButtonLink variant="primary" fit href={event.href}>
                {event.button ?? "Register"}
              </ButtonLink>
            ) : (
              <ButtonAnchor variant="primary" fit href={event.href} {...external}>
                {event.button ?? "Register"}
              </ButtonAnchor>
            )}
            {event.extras?.map((extra) => (
              <a key={extra.href} className={styles.extra} href={extra.href} target="_blank" rel="noreferrer">
                {extra.label} →
              </a>
            ))}
          </div>
        </div>
        <div className={styles.cover}>
          <Image src={event.image} alt="" fill sizes="200px" style={{ objectFit: "cover" }} />
        </div>
      </div>
    </li>
  );
}

/** Any other event: an orange row with its day, its name, when and where, and a link to register. */
function Row({ day, event, going }: { day: FestDay; event: FestEvent; going?: EventGoing | null }) {
  const { internal, ...external } = linkProps(event.href);
  return (
    <li className={styles.row}>
      <div className={`container ${styles.columns}`}>
        <p className={styles.rowDay}>{day.short}</p>
        <div>
          <h3 className={styles.rowTitle}>{event.title}</h3>
          <p className={styles.rowMeta}>
            {event.time} · {event.place}
          </p>
          {going && <Going going={going} />}
        </div>
        <a className={styles.rowLink} href={event.href} {...(internal ? {} : external)}>
          Register →
        </a>
      </div>
    </li>
  );
}

/**
 * The festival's events in order, as its poster lists them: the main ones in
 * black bands, the rest in orange rows, each with who's going, by its Luma ID,
 * where Luma could say.
 */
export default function Programme({
  days,
  going = {},
}: {
  days: FestDay[];
  going?: Record<string, EventGoing | null>;
}) {
  return (
    <section className={styles.programme} aria-labelledby="programme-heading">
      <div className="container">
        <h2 id="programme-heading" className={styles.heading}>
          Four days of action
        </h2>
      </div>
      <ol className={styles.list}>
        {days.flatMap((day) =>
          day.events.map((event) =>
            event.featured ? (
              <Featured key={event.href} day={day} event={event} going={event.lumaId ? going[event.lumaId] : null} />
            ) : (
              <Row key={event.href} day={day} event={event} going={event.lumaId ? going[event.lumaId] : null} />
            ),
          ),
        )}
      </ol>
    </section>
  );
}
