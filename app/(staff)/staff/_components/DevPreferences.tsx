import { staffCopy } from "@/lib/content/staff-interface";
import styles from "./DevPreferences.module.css";

const copy = staffCopy.devPreferences;

/** Where an address's contact preferences open from, with a fresh link (app/(staff)/staff/api/dev-contact-preferences). */
const openPath = (address: string) => `/staff/api/dev-contact-preferences?address=${encodeURIComponent(address)}`;

/**
 * Development only, at the foot of a supporter's consents in a fixture
 * build: a box in the development colour, as the dev login's, with a link
 * per address that opens their contact preferences with a fresh link, as
 * one of our emails would; a link, so it can open in a new tab. Given no
 * addresses, as outside a fixture build, it's nothing.
 */
export default function DevPreferences({ emails }: { emails: string[] | undefined }) {
  if (!emails?.length) return null;
  return (
    <section className={styles.dev} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      <ul className={styles.choices}>
        {emails.map((email) => (
          <li key={email}>
            <a href={openPath(email)}>{email}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
