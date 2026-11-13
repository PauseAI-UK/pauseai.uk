import Image from "next/image";
import type { ReactNode } from "react";
import { staffCopy } from "@/lib/content/staff-interface";
import styles from "./ImportIcon.module.css";

/** Where a job reads from, or works on. */
export type ImportSource =
  | "airtable"
  | "luma"
  | "civicrm"
  | "gmail"
  | "parliament"
  | "scottish-parliament"
  | "senedd"
  | "ni-assembly"
  | "controlai"
  | "database";

// Each service's own mark, in its own colours: Airtable's three boxes (its
// shape Simple Icons', https://simpleicons.org, CC0), Gmail's M, and Luma's
// star, CiviCRM's triangle and ControlAI's box, their own pictures from
// luma.com, civicrm.org and controlai.com, as Luma's is shaded and the others
// have no flat copy to hand. Parliament's is a plain portcullis in the
// Commons' green, not its crowned one, whose use Parliament restricts
// (https://www.parliament.uk/site-information/copyright-parliament/the-crowned-portcullis/).
// Our own database, no one's, is a stack of discs.
const MARKS: Record<ImportSource, ReactNode> = {
  airtable: (
    <svg viewBox="0 0 24 24">
      <path
        fill="var(--brand-airtable-yellow)"
        d="M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 0 0 2.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 0 0-1.272-.257z"
      />
      <path
        fill="var(--brand-airtable-blue)"
        d="M23.4 8.056a.589.589 0 0 0-.222.045l-10.012 3.877a.612.612 0 0 0-.38.564v8.896a.6.6 0 0 0 .821.552L23.62 18.1a.583.583 0 0 0 .38-.551V8.653a.6.6 0 0 0-.6-.596z"
      />
      <path
        fill="var(--brand-airtable-red)"
        d="M.676 8.095a.644.644 0 0 0-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 0 0-.207-.044z"
      />
    </svg>
  ),
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
  // Chains from its top corners, a beam, five bars down ending in spikes, and three across.
  parliament: (
    <svg viewBox="0 0 24 24" fill="var(--brand-parliament-green)">
      <path d="M3 1h1.5v4H3zM19.5 1H21v4h-1.5z" />
      <path d="M2 5h20v2H2z" />
      <path d="M3 7h1.6v12L3.8 21 3 19zM7.6 7h1.6v12l-.8 2-.8-2zM11.2 7h1.6v12l-.8 2-.8-2zM14.8 7h1.6v12l-.8 2-.8-2zM19.4 7H21v12l-.8 2-.8-2z" />
      <path d="M3 10h18v1.5H3zM3 13.5h18V15H3zM3 17h18v1.5H3z" />
    </svg>
  ),
  // The Saltire, white on blue, standing for the Scottish Parliament.
  "scottish-parliament": (
    <svg viewBox="0 0 24 24">
      <rect x="1" y="4" width="22" height="16" rx="1.5" fill="var(--brand-saltire-blue)" />
      <path d="M2.5 5.5 21.5 18.5M21.5 5.5 2.5 18.5" stroke="var(--white)" strokeWidth="2.6" />
    </svg>
  ),
  // The Welsh flag's white over green, with a red diamond for its dragon, standing for the Senedd.
  senedd: (
    <svg viewBox="0 0 24 24">
      <rect x="1" y="4" width="22" height="8" rx="1.5" fill="var(--white)" stroke="var(--brand-wales-green)" />
      <rect x="1" y="12" width="22" height="8" rx="1.5" fill="var(--brand-wales-green)" />
      <path d="M12 6.5 17 12l-5 5.5L7 12z" fill="var(--brand-wales-red)" />
    </svg>
  ),
  // Stormont's front, plainly: a pediment, six columns and the steps, standing for the Northern Ireland Assembly.
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
  const label = staffCopy.import[source];
  return (
    <span className={styles.tile} title={label} role="img" aria-label={label}>
      <span className={styles.mark} aria-hidden="true">
        {MARKS[source]}
      </span>
    </span>
  );
}
