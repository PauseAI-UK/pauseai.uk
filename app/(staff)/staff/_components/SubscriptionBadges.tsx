import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import { CHANNELS, topicsOf, type Channel, type ContactPermission, type Topic } from "@/lib/contact-permissions";

/** How much a send says we'd contact them, most first. */
const RANK = { yes: 0, unsure: 1, no: 2 } as const;

type Gets = { channel: Channel; topic: Topic; sure: boolean };

/**
 * What a supporter gets: each topic we'd email them about at any of their
 * addresses, then each we'd contact them about at any of their numbers,
 * sure or not. An address that's blocked is a no, so gets nothing.
 */
function subscriptions(permissions: ContactPermission[]): Gets[] {
  return CHANNELS.flatMap((channel) =>
    topicsOf(channel).flatMap((topic) => {
      const best = permissions
        .filter((p) => p.channel === channel && p.topic === topic)
        .map((p) => p.send)
        .sort((a, b) => RANK[a] - RANK[b])[0];
      return best === "yes" || best === "unsure" ? [{ channel, topic, sure: best === "yes" }] : [];
    }),
  );
}

/** A topic's name in the list, by its channel. */
function name({ channel, topic, sure }: Gets): string {
  const copy = staffCopy.supporters.subscriptions;
  const named = copy.topics[channel][topic];
  return sure ? named : copy.unsure(named);
}

/** What a supporter gets, in words, as a download has it. */
export function subscriptionWords(permissions: ContactPermission[]): string {
  return subscriptions(permissions).map(name).join("; ");
}

/**
 * What a supporter gets, as lozenges: a topic we'd contact them about,
 * green, or amber when we can't be sure.
 */
export default function SubscriptionBadges({ permissions }: { permissions: ContactPermission[] }) {
  return subscriptions(permissions).map((one) => (
    <Tag key={`${one.channel}-${one.topic}`} tone={one.sure ? "green" : "amber"}>
      {name(one)}
    </Tag>
  ));
}
