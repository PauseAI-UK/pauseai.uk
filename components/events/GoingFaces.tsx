import Image from "next/image";
import type { FeaturedGuest } from "@/lib/going";
import styles from "./GoingFaces.module.css";

/** How many faces GoingFaces shows, as Luma does. */
const FACES = 6;

/**
 * The faces of the guests Luma features for an event, overlapping, as its
 * page shows them: each one's photo, or their initial. Hidden from screen
 * readers, as the names beside it say who they are.
 */
export default function GoingFaces({ guests }: { guests: FeaturedGuest[] }) {
  return (
    <ul className={styles.faces} aria-hidden>
      {guests.slice(0, FACES).map((guest, i) => (
        <li key={i} className={styles.face}>
          {guest.avatar ? (
            <Image src={guest.avatar} alt="" fill sizes="32px" style={{ objectFit: "cover" }} />
          ) : (
            guest.name.charAt(0)
          )}
        </li>
      ))}
    </ul>
  );
}
