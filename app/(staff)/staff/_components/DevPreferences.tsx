import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import styles from "./DevPreferences.module.css";

const copy = staffCopy.devPreferences;

/** Where the dev route opens from, with a fresh link (app/(staff)/staff/api/dev-contact-preferences). */
const ROUTE = "/staff/api/dev-contact-preferences";

/** A copy of a broadcast they were sent, as far as its unsubscribe link goes. */
export type DevCopy = { copyId: number; channel: string; topics: Topic[]; sentAt: Date | null };

/** The latest copy sent by email for each set of topics, newest first, as the supporter's page lists them. */
function unsubscribable(copies: DevCopy[]): DevCopy[] {
  const seen = new Set<string>();
  return copies.filter((one) => {
    const key = one.topics.join(" ");
    if (one.channel !== "email" || !one.sentAt || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Development only, at the foot of a supporter's consents in a fixture
 * build: a box in the development colour, as the dev login's, with a link
 * per address that opens their contact preferences with a fresh link, as
 * one of our emails would; and below them a link per kind of broadcast
 * email they were sent, by its topics, which opens the latest one's
 * unsubscribe page. Links, so they can open in a new tab. Outside a fixture
 * build, or for someone with no address, it's nothing.
 */
export default function DevPreferences({
  emails,
  copies,
  fixtures,
}: {
  emails: string[];
  copies: DevCopy[];
  fixtures: boolean;
}) {
  if (!fixtures || !emails.length) return null;
  return (
    <section className={styles.dev} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      <ul className={styles.choices}>
        {emails.map((email) => (
          <li key={email}>
            <a href={`${ROUTE}?address=${encodeURIComponent(email)}`}>{copy.preferences(email)}</a>
          </li>
        ))}
        {unsubscribable(copies).map((one) => (
          <li key={one.copyId}>
            <a href={`${ROUTE}?copy=${one.copyId}`}>
              {copy.unsubscribe(one.topics.map((topic) => emailSettingsCopy.topics[topic]).join(" and "))}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
