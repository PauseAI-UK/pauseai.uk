import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import { CONSENTS, TOPICS, consentKey, type Consent, type ContactPermission } from "@/lib/contact-permissions";
import ChannelIcon from "./ChannelIcon";
import styles from "./SubscriptionBadges.module.css";

/**
 * What a supporter gets: each consent, a topic by a way, that any of their
 * addresses or numbers says yes to. An address that's blocked is a no, so
 * gets nothing.
 */
function subscriptions(permissions: ContactPermission[]): Consent[] {
  return CONSENTS.filter((consent) =>
    permissions.some((p) => p.topic === consent.topic && p.way === consent.way && p.send === "yes"),
  );
}

/** What a supporter gets, in words, as a download has it: a consent each. */
export function subscriptionWords(permissions: ContactPermission[]): string {
  return subscriptions(permissions)
    .map((consent) => staffCopy.supporters.subscriptions.consents[consentKey(consent)])
    .join("; ");
}

/**
 * What a supporter gets, as green lozenges, a topic each: the icon of each
 * way it's a yes by, as the Consent filter and the supporter's page draw
 * them, each named for a screen reader, then the topic's name.
 */
export default function SubscriptionBadges({ permissions }: { permissions: ContactPermission[] }) {
  const yes = subscriptions(permissions);
  return TOPICS.flatMap((topic) => {
    const ways = yes.filter((consent) => consent.topic === topic).map((consent) => consent.way);
    if (ways.length === 0) return [];
    return [
      <Tag key={topic} tone="green">
        <span className={styles.ways}>
          {ways.map((way) => (
            <ChannelIcon key={way} channel={way} label={staffCopy.supporters.filters.ways[way]} />
          ))}
        </span>
        {staffCopy.supporters.filters.topics[topic]}
      </Tag>,
    ];
  });
}
