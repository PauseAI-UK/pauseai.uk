import Image from "next/image";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import type { FestDay, FestEvent } from "@/lib/content/pausefest";
import styles from "./Lineup.module.css";

/** Register on the march's own sign-up, a page of ours, or on Luma, in a new tab. */
function Register({ href }: { href: string }) {
  if (href.startsWith("/"))
    return (
      <ButtonLink variant="primary" size="small" fit href={href}>
        Register
      </ButtonLink>
    );
  return (
    <ButtonAnchor variant="primary" size="small" fit href={href} target="_blank" rel="noreferrer">
      Register
    </ButtonAnchor>
  );
}

function EventCard({ event }: { event: FestEvent }) {
  return (
    <article className={styles.card} data-featured={event.featured || undefined}>
      <div className={styles.image}>
        <Image
          src={event.image}
          alt=""
          fill
          style={{ objectFit: "cover" }}
          // One of four columns on a desktop (the featured one wider), two on a
          // tablet, and the whole width on a phone.
          sizes="(max-width: 520px) 100vw, (max-width: 860px) 50vw, 400px"
        />
      </div>
      <div className={styles.body}>
        <p className={styles.time}>{event.time}</p>
        <h3 className={styles.title}>{event.title}</h3>
        <p className={styles.place}>{event.place}</p>
        <p className={styles.blurb}>{event.blurb}</p>
        <div className={styles.actions}>
          <Register href={event.href} />
          {event.extras?.map((extra) => (
            <a key={extra.href} className={styles.extra} href={extra.href} target="_blank" rel="noreferrer">
              {extra.label} →
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

/** The festival's days side by side, each with its events, the day of the main event wider. */
export default function Lineup({ days }: { days: FestDay[] }) {
  return (
    <div className={`container ${styles.lineup}`}>
      {days.map((day) => (
        <section
          key={day.id}
          id={day.id}
          className={styles.day}
          data-featured={day.events.some((event) => event.featured) || undefined}
          aria-labelledby={`${day.id}-heading`}
        >
          <h2 id={`${day.id}-heading`} className={styles.dayHead}>
            <span className={styles.weekday}>{day.weekday}</span> {day.date}
          </h2>
          {day.events.map((event) => (
            <EventCard key={event.href} event={event} />
          ))}
        </section>
      ))}
    </div>
  );
}
