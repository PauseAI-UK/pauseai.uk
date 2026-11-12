import { staffDate, staffTime } from "@/lib/staff-time";
import styles from "./When.module.css";

/**
 * When something happened, on one line however narrow its cell: the day
 * and the time, "16 Oct 2026, 10:34" (lib/staff-time.ts), or with `day`
 * the day alone. For a date beside or under other words in a cell; a
 * column of dates alone is a `short` one (ListFrame).
 */
export default function When({ at, day = false }: { at: Date; day?: boolean }) {
  return (
    <time dateTime={new Date(at).toISOString()} className={styles.when}>
      {day ? staffDate(at) : staffTime(at)}
    </time>
  );
}
