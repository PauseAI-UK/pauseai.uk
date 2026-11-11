import ExternalLink from "./ui/ExternalLink";
import StaffLink from "./ui/StaffLink";
import { staffCopy } from "@/lib/content/staff-interface";
import { TOPICS, WAYS, type Channel, type ContactPermission, type Topic, type Way } from "@/lib/contact-permissions";
import { phoneWords } from "@/lib/phone";
import { staffDate } from "@/lib/staff-time";
import ChannelIcon from "./ChannelIcon";
import Tag from "@/components/ui/Tag";
import { BubbleBox } from "./ui/Bubble";
import { bubbleTrigger } from "./ui/bubble-trigger";
import styles from "./PermissionTiles.module.css";

const copy = staffCopy.supporters.detail.permissions;

/**
 * The short reason for an answer, with when and where it came from. A
 * blocked address's is what blocked it, or nothing for a cause the copy has
 * no words for. A member who's gone is gone from where members are read,
 * not from the join form they filled in.
 */
export function permissionReason(permission: ContactPermission): string {
  const when = permission.at ? staffDate(permission.at) : "";
  if (permission.reason === "blocked") return copy.blockedBecause[permission.source ?? ""]?.(when) ?? "";
  const source =
    permission.reason === "left" && permission.source === "airtable"
      ? copy.membersFrom
      : (copy.sources[permission.source ?? ""] ?? copy.otherSource);
  return copy.reasons[permission.reason](when, source, permission.topic);
}

/** What's behind a row's "?": the topic's name, what it is, and when it's a yes and when a no. */
function TopicDetails({ topic, name }: { topic: Topic; name: string }) {
  const details = copy.details[topic];
  return (
    <>
      <strong className={styles.topicTitle}>{copy.topicTitle(name)}</strong>
      <p>{details.about}</p>
      <dl className={styles.when}>
        <dt>{copy.when.yes}</dt>
        <dd>{details.yes}</dd>
        <dt>{copy.when.no}</dt>
        <dd>{details.no}</dd>
      </dl>
    </>
  );
}

/**
 * An address or number as a link that contacts them by `way`: to email, to
 * WhatsApp, which is how we text, or, for a call or a number's texts and
 * calls alike, to ring.
 */
export function ContactLink({ address, way }: { address: string; way: Channel | Way }) {
  if (way === "email") return <a href={`mailto:${address}`}>{address}</a>;
  if (way === "text") {
    return <ExternalLink href={`https://wa.me/${address.replace(/\D/g, "")}`}>{phoneWords(address)}</ExternalLink>;
  }
  return <a href={`tel:${address}`}>{phoneWords(address)}</a>;
}

/**
 * The address or number a line is for, smaller, after a tiny icon of how
 * the line's answer would reach them (`icon`): an envelope, a speech bubble
 * for texts, or a handset for calls, or a number's texts and calls alike;
 * with `link`, as where we may contact them, a link that does it.
 */
function Address({
  channel,
  icon,
  address,
  link,
}: {
  channel: Channel;
  icon: Channel | Way;
  address: string;
  link: boolean;
}) {
  return (
    <span className={styles.address}>
      <ChannelIcon channel={icon} label={copy[channel]} />
      {link ? <ContactLink address={address} way={icon} /> : channel === "email" ? address : phoneWords(address)}
    </span>
  );
}

/** Why an answer is what it is; after a blocked address's, the link to the blocked emails. */
function Reason({ permission }: { permission: ContactPermission }) {
  const words = permissionReason(permission);
  const blocked = permission.reason === "blocked";
  return (
    <span className={styles.reason}>
      {blocked && words ? `${words} · ` : words}
      {blocked && <StaffLink href="/staff/supporters/blocked-emails">{copy.seeBlocked}</StaffLink>}
    </span>
  );
}

/** An answer as a line shows it: one way's, or a number's text and call answers when they're the same in every way. */
type Line = { permission: ContactPermission; both: boolean };

/** Whether two answers by a number say the same, for the same reason, from the same source, since the same time. */
function same(a: ContactPermission, b: ContactPermission): boolean {
  return (
    a.address === b.address &&
    a.send === b.send &&
    a.reason === b.reason &&
    a.source === b.source &&
    a.at?.getTime() === b.at?.getTime()
  );
}

/** Each answer a line, but a call that says the same as its number's text, which goes on the text's line. */
function lines(permissions: ContactPermission[]): Line[] {
  const texts = permissions.filter((p) => p.way === "text");
  const merged = (p: ContactPermission) => p.way === "call" && texts.some((text) => same(text, p));
  return permissions
    .filter((p) => !merged(p))
    .map((permission) => ({
      permission,
      both: permission.way === "text" && permissions.some((p) => merged(p) && same(p, permission)),
    }));
}

/**
 * One topic, a row: its name and the "?" with what it is; then each way and
 * address or number it has an answer for, email first, then texts, then
 * calls, with that answer in its words, green for a yes, and under it why,
 * where from and when. A number that can be texted and called alike, or
 * neither, for the same reason, has one line for both, a lozenge each.
 */
function TopicRow({ topic, permissions }: { topic: Topic; permissions: ContactPermission[] }) {
  const id = `why-${topic}`;
  const name = copy.topics[topic];
  return (
    <li className={styles.item}>
      <span className={styles.head}>
        <span className={styles.topic}>{name}</span>
        <button type="button" className={styles.help} aria-label={copy.why} {...bubbleTrigger(id)}>
          ?
        </button>
      </span>
      {lines(permissions).map(({ permission, both }) => (
        <span key={`${permission.way}-${permission.address}`} className={styles.answer} data-send={permission.send}>
          <span className={styles.line}>
            <Address
              channel={permission.channel}
              icon={both ? "phone" : permission.way}
              address={permission.address}
              link={permission.send === "yes"}
            />
            <span className={styles.tags}>
              {(both ? (["text", "call"] as const) : [permission.way]).map((way) => (
                <Tag key={way} tone={permission.send === "yes" ? "green" : undefined}>
                  {copy.answers[way][permission.send]}
                </Tag>
              ))}
            </span>
          </span>
          <Reason permission={permission} />
        </span>
      ))}
      <BubbleBox id={id} className={styles.popover}>
        <TopicDetails topic={topic} name={name} />
      </BubbleBox>
    </li>
  );
}

/**
 * Whether we'd contact a supporter about each topic, a row each, every
 * address and number it has an answer for in it, by email, then text, then
 * call.
 */
export default function PermissionTiles({ permissions }: { permissions: ContactPermission[] }) {
  const byWay = (a: ContactPermission, b: ContactPermission) => WAYS.indexOf(a.way) - WAYS.indexOf(b.way);
  return (
    <ul className={styles.list}>
      {TOPICS.flatMap((topic) => {
        const own = permissions.filter((p) => p.topic === topic).sort(byWay);
        return own.length > 0 ? [<TopicRow key={topic} topic={topic} permissions={own} />] : [];
      })}
    </ul>
  );
}
