import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./ImportIcon.module.css";
import { jobsCopy } from "./copy";

/** Where a job reads from, or works on. */
export type ImportSource =
  | "luma"
  | "civicrm"
  | "gmail"
  | "parliament"
  | "scottish-parliament"
  | "senedd"
  | "ni-assembly"
  | "controlai"
  | "database";

// Each service's own mark, in its own colours: Gmail's M, and Luma's
// star, CiviCRM's triangle and ControlAI's box, their own pictures from
// luma.com, civicrm.org and controlai.com, as Luma's is shaded and the others
// have no flat copy to hand. Our own database, no one's, is a stack of discs.
const MARKS: Record<ImportSource, ReactNode> = {
  gmail: (
    <svg viewBox="52 42 88 66">
      <path fill="var(--brand-gmail-blue)" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="var(--brand-gmail-green)" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="var(--brand-gmail-yellow)" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="var(--brand-gmail-red)" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="var(--brand-gmail-dark-red)" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  ),
  luma: <Image src="/images/logos/luma.png" alt="" width={36} height={36} />,
  civicrm: <Image src="/images/logos/civicrm.png" alt="" width={36} height={35} />,
  controlai: <Image src="/images/logos/controlai.png" alt="" width={36} height={36} />,
  // Each body by its building, plainly, in one colour: Parliament by the
  // Elizabeth Tower, its clock cut out; the Scottish Parliament by Holyrood's
  // leaf-shaped roofs over its front; the Senedd by its wavy roof over its
  // glass front and steps; the Northern Ireland Assembly by Stormont's front,
  // a pediment, six columns and the steps.
  parliament: (
    <svg viewBox="0 0 24 24" fill="var(--brand-parliament-green)" fillRule="evenodd">
      <path d="M12 0.5 15 5.5H9z" />
      <path d="M9 5.5h6V8H9z" />
      <path d="M7.5 8h9v8h-9zM12 9.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z" />
      <path d="M11.5 10.2h1v2h1.5v1h-2.5z" />
      <path d="M8.3 16h7.4v6H8.3zM10 17.5h1.4v3H10zM12.6 17.5H14v3h-1.4z" />
      <path d="M6.5 22h11v1.5h-11z" />
    </svg>
  ),
  "scottish-parliament": (
    <svg viewBox="0 0 24 24" fill="var(--brand-holyrood-blue)">
      <path d="M2 13.5C5 8 10 6.5 13 9.5 9.5 10 6 11.5 2 13.5z" />
      <path d="M7 13C10.5 7 16 5.5 19 8.5 15 9.5 11 11 7 13z" />
      <path d="M12 12.8C15.5 8.5 20 7.8 22.5 10 19 11 15.5 12 12 12.8z" />
      <path d="M2 15h20v6H2z" opacity=".35" />
      <path d="M2 14h20v1.5H2zM2 20.5h20V22H2zM5 15.5h1.2v5H5zM9 15.5h1.2v5H9zM13 15.5h1.2v5H13zM17 15.5h1.2v5H17z" />
    </svg>
  ),
  senedd: (
    <svg viewBox="0 0 24 24" fill="var(--brand-senedd-green)">
      <path d="M0.5 6.5C4 5 8 8.5 12 7s8-2 11.5-0.5V9.5C20 8 16 9 12 10.2S4 8 0.5 9.5z" />
      <path d="M3 10.5h18V19H3z" opacity=".35" />
      <path d="M3 10.2h1.4V19H3zM11.3 10.4h1.4V19h-1.4zM19.6 9.4H21V19h-1.4z" />
      <path d="M1.5 19h21v1.6h-21zM0.5 21.3h23v1.6H0.5z" />
    </svg>
  ),
  "ni-assembly": (
    <svg viewBox="0 0 24 24" fill="var(--brand-stormont-blue)">
      <path d="M12 2 22 7H2z" />
      <path d="M3.5 8.5h2v9h-2zM7 8.5h2v9H7zM10.5 8.5h1.5v9h-1.5zM12 8.5h1.5v9H12zM15 8.5h2v9h-2zM18.5 8.5h2v9h-2z" />
      <path d="M2 18.5h20v1.5H2zM1 21h22v1.5H1z" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" className={styles.line}>
      <path d="M4 5.5c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3z" />
      <path d="M4 5.5v13c0 1.66 3.58 3 8 3s8-1.34 8-3v-13" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  ),
};

/** Where an import reads from, as its mark on a tile, named for screen readers and on hover. */
export default function ImportIcon({ source }: { source: ImportSource }) {
  const label = jobsCopy.import[source];
  return (
    <span className={styles.tile} title={label} role="img" aria-label={label}>
      <span className={styles.mark} aria-hidden="true">
        {MARKS[source]}
      </span>
    </span>
  );
}
