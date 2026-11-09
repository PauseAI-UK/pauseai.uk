import { pausefest } from "@/lib/content/pausefest";
import styles from "./PauseFestHero.module.css";

/** PauseFest's first screen, as its flyer: the name on an orange band, and a ticket for each day that jumps to it. */
export default function PauseFestHero() {
  return (
    <header className={styles.hero}>
      <div className="container">
        <h1 className={styles.title}>{pausefest.name}</h1>
        <p className={styles.tagline}>{pausefest.tagline}</p>
        <nav className={styles.days} aria-label="Days">
          {pausefest.days.map((day) => (
            <a key={day.id} className={styles.day} href={`#${day.id}`}>
              <span className={styles.when}>
                <span className={styles.weekday}>{day.weekday}</span> {day.date}
              </span>
              <span className={styles.what}>{day.events.map((event) => event.title).join(" · ")}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
