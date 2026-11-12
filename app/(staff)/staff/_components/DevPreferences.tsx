import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import { TOPICS, type ContactPermission } from "@/lib/contact-permissions";
import styles from "./DevPreferences.module.css";

const copy = staffCopy.devPreferences;

/** Where the dev route opens from, with a fresh link (app/(staff)/staff/api/dev-contact-preferences). */
const ROUTE = "/staff/api/dev-contact-preferences";

/**
 * Development only, at the foot of a supporter's consents in a fixture
 * build: a box in the development colour, as the dev login's, with a link
 * per address that opens their contact preferences with a fresh link, as
 * one of our emails would; and below them a link per topic they get by
 * email, which opens the unsubscribe page of their latest email under it,
 * one made for it if there's none. Links, so they can open in a new tab.
 * Outside a fixture build, or for someone with no address, it's nothing.
 */
export default function DevPreferences({
  emails,
  permissions,
  fixtures,
}: {
  emails: string[];
  permissions: Pick<ContactPermission, "address" | "topic" | "way" | "send">[];
  fixtures: boolean;
}) {
  if (!fixtures || !emails.length) return null;
  const yeses = TOPICS.flatMap((topic) => {
    const yes = permissions.find((p) => p.topic === topic && p.way === "email" && p.send === "yes");
    return yes ? [{ topic, address: yes.address }] : [];
  });
  return (
    <section className={styles.dev} aria-label={copy.title}>
      <h2 className={styles.title}>{copy.title}</h2>
      <ul className={styles.choices}>
        {emails.map((email) => (
          <li key={email}>
            <a href={`${ROUTE}?address=${encodeURIComponent(email)}`}>{copy.preferences(email)}</a>
          </li>
        ))}
        {yeses.map(({ topic, address }) => (
          <li key={topic}>
            <a href={`${ROUTE}?${new URLSearchParams({ address, topic })}`}>
              {copy.unsubscribe(emailSettingsCopy.topics[topic])}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
