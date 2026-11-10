import GoingFaces from "@/components/events/GoingFaces";
import { goingCopy } from "@/lib/content/going";
import { goingNames, type EventGoing } from "@/lib/going";
import styles from "./Going.module.css";

/** Who's going to an event, as its Luma page shows it: the featured guests' faces, how many, and the first two names. */
export default function Going({ going }: { going: EventGoing }) {
  return (
    <div className={styles.going}>
      {going.guests.length > 0 && <GoingFaces guests={going.guests} />}
      <p className={styles.text}>
        <strong>{goingCopy.count(going.count.toLocaleString("en-GB"))}</strong>
        {going.guests.length > 0 && <> · {goingNames(going)}</>}
      </p>
    </div>
  );
}
