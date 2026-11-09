import Image from "next/image";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import type { FestDay, FestEvent } from "@/lib/content/pausefest";
import styles from "./Programme.module.css";

/** Where to register: the march's own sign-up, a page of ours, or Luma, in a new tab. */
function linkProps(href: string) {
  return href.startsWith("/") ? { internal: true } : { internal: false, target: "_blank", rel: "noreferrer" };
}

/** A featured event's band: the date and time, its name large, where, and its cover where the flyer has a QR code. */
function Featured({ day, event }: { day: FestDay; event: FestEvent }) {
  const { internal, ...external } = linkProps(event.href);
  return (
    <li className={styles.featured}>
      <div className={`container ${styles.featuredInner}`}>
        <div>
          <p className={styles.featuredWhen}>
            {day.long}, {event.time}
          </p>
          <h3 className={styles.featuredTitle}>{event.title}</h3>
          <p className={styles.featuredPlace}>{event.place}</p>
          <div className={styles.actions}>
            {internal ? (
              <ButtonLink variant="primary" fit href={event.href}>
                Register
              </ButtonLink>
            ) : (
              <ButtonAnchor variant="primary" fit href={event.href} {...external}>
                Register
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
          <Image src={event.image} alt="" fill sizes="220px" style={{ objectFit: "cover" }} />
        </div>
      </div>
    </li>
  );
}

/** Any other event: a row with its day, its name, when and where, and a link to register. */
function Row({ day, event }: { day: FestDay; event: FestEvent }) {
  const { internal, ...external } = linkProps(event.href);
  return (
    <li className={styles.row}>
      <div className={`container ${styles.rowInner}`}>
        <p className={styles.rowDay}>{day.short}</p>
        <div>
          <h3 className={styles.rowTitle}>{event.title}</h3>
          <p className={styles.rowMeta}>
            {event.time} · {event.place}
          </p>
        </div>
        <a className={styles.rowLink} href={event.href} {...(internal ? {} : external)}>
          Register →
        </a>
      </div>
    </li>
  );
}

/** The festival's events in order, as its flyer lists them: the main ones in black bands, the rest in orange rows. */
export default function Programme({ days }: { days: FestDay[] }) {
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
              <Featured key={event.href} day={day} event={event} />
            ) : (
              <Row key={event.href} day={day} event={event} />
            ),
          ),
        )}
      </ol>
    </section>
  );
}
