import Image from "next/image";
import { pausefest } from "@/lib/content/pausefest";
import type { EventGoing } from "@/lib/server/outside-services/luma-public";
import styles from "./Going.module.css";

/** How many guests Going names before "and N others", and how many faces it shows, as Luma does. */
const NAMED = 2;
const FACES = 6;

/** "Jane, Sam and 1,111 others", or, when Luma features everyone going, "Jane and Sam". */
function names({ count, guests }: EventGoing): string {
  const named = guests.slice(0, NAMED).map((guest) => guest.name);
  const others = count - named.length;
  if (others <= 0) return named.join(" and ");
  return `${named.join(", ")} and ${pausefest.going.others(others.toLocaleString("en-GB"), others === 1)}`;
}

/** Who's going to an event, as its Luma page shows it: the featured guests' faces, how many, and the first two names. */
export default function Going({ going }: { going: EventGoing }) {
  return (
    <div className={styles.going}>
      {going.guests.length > 0 && (
        <ul className={styles.faces} aria-hidden>
          {going.guests.slice(0, FACES).map((guest, i) => (
            <li key={i} className={styles.face}>
              {guest.avatar ? (
                <Image src={guest.avatar} alt="" fill sizes="32px" style={{ objectFit: "cover" }} />
              ) : (
                guest.name.charAt(0)
              )}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.text}>
        <strong>{pausefest.going.count(going.count.toLocaleString("en-GB"))}</strong>
        {going.guests.length > 0 && <> · {names(going)}</>}
      </p>
    </div>
  );
}
