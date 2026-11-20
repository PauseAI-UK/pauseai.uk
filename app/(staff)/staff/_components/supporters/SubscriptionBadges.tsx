import Tag from "@/components/ui/Tag";
import { listsOn, type ContactPermission } from "@/lib/supporters/contact-permissions";
import ChannelIcon from "@/components/ui/ChannelIcon";
import styles from "./SubscriptionBadges.module.css";
import { supportersCopy } from "./copy";
import { personListName } from "./PermissionTiles";

const copy = supportersCopy.supporters;

/** The lists a supporter is on, in words, as a download has them: each list, then the ways it reaches them. */
export function subscriptionWords(permissions: ContactPermission[]): string {
  return listsOn(permissions)
    .map(({ list, ways }) =>
      copy.subscriptions.listBy(
        personListName(list),
        ways.map((way) => copy.filters.ways[way]),
      ),
    )
    .join("; ");
}

/**
 * The lists a supporter is on, as green lozenges, one each: the icon of each
 * way it reaches them, as the Consent filter and the supporter's page draw
 * them, each named for a screen reader, then the list's name: inc. Luma
 * only where Luma alone reaches them, under its name for that (listsOn,
 * personListName).
 */
export default function SubscriptionBadges({ permissions }: { permissions: ContactPermission[] }) {
  return listsOn(permissions).map(({ list, ways }) => (
    <Tag key={list} tone="green">
      <span className={styles.ways} data-beside="lowercase">
        {ways.map((way) => (
          <ChannelIcon key={way} channel={way} label={copy.filters.ways[way]} />
        ))}
      </span>
      {personListName(list)}
    </Tag>
  ));
}
