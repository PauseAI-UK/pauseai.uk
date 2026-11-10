import type React from "react";
import StaffLink from "./ui/StaffLink";
import { staffCopy } from "@/lib/content/staff-interface";
import { CHANNELS, waysKey, type Channel, type ContactPermission, type Topic } from "@/lib/contact-permissions";
import { staffDate } from "@/lib/staff-time";
import ChannelIcon from "./ChannelIcon";
import Tag from "@/components/ui/Tag";
import { BubbleBox } from "./ui/Bubble";
import { bubbleTrigger } from "./ui/bubble-trigger";
import styles from "./PermissionTiles.module.css";

const copy = staffCopy.supporters.detail.permissions;

/**
 * The short reason for an answer, with when and, for our forms', which form;
 * the reason itself where the copy has no words for it. A blocked address's
 * is what blocked it, or nothing for a cause the copy has no words for.
 */
export function permissionReason(permission: ContactPermission): string {
  if (permission.reason === "blocked") {
    const because = copy.blockedBecause[permission.source ?? ""];
    return because ? because(staffDate(permission.at!)) : "";
  }
  const words = copy.reasons[permission.topic]?.[permission.reason];
  const form = copy.forms[permission.source ?? ""] ?? copy.otherForm;
  return words ? words(permission.at ? staffDate(permission.at) : "", form) : permission.reason;
}

/** An answer's colour, on it alone: green we'd contact them, amber we don't know, plain we wouldn't. */
const TONES = { yes: "green", unsure: "amber", no: undefined } as const;

/**
 * What's behind a row's "?": the topic's name, then for each channel it
 * has here, named with its icon, what it is, when we would
 * contact them and when not, in the words of the ways it allows, and, for
 * some, what we can't see, each under its label.
 */
function TopicDetails({ topic, channels, name }: { topic: Topic; channels: Channel[]; name: string }) {
  return (
    <>
      <strong className={styles.topicTitle}>{copy.topicTitle(name)}</strong>
      {channels.map((channel) => {
        const details = copy.details[channel][topic];
        const when = copy.when[waysKey(channel, topic)];
        return (
          <div key={channel} className={styles.channel}>
            <p className={styles.channelName}>
              <ChannelIcon channel={channel} />
              {staffCopy.supporters.filters.channels[channel]}
            </p>
            <p>{details.about}</p>
            <dl className={styles.when}>
              <dt>{when.yes}</dt>
              <dd>{details.yes}</dd>
              <dt>{when.no}</dt>
              <dd>{details.no}</dd>
              {details.caveat && (
                <>
                  <dt>{copy.caveat}</dt>
                  <dd>{details.caveat}</dd>
                </>
              )}
            </dl>
          </div>
        );
      })}
    </>
  );
}

/**
 * The address or number a row is for, smaller, after a tiny envelope or
 * phone; a link to write or ring with `link`, as where we may contact them.
 */
function Address({ channel, address, link }: { channel: Channel; address: string; link: boolean }) {
  return (
    <span className={styles.address}>
      <ChannelIcon channel={channel} label={copy[channel]} />
      {link ? <a href={channel === "email" ? `mailto:${address}` : `tel:${address}`}>{address}</a> : address}
    </span>
  );
}

/** Why an answer is what it is; after a blocked address's, the link to the blocked emails. */
function Reason({ words, blocked }: { words: string; blocked: boolean }) {
  return (
    <span className={styles.reason}>
      {blocked && words ? `${words} ` : words}
      {blocked && <StaffLink href="/staff/supporters/blocked-emails">{copy.seeBlocked}</StaffLink>}
    </span>
  );
}

/**
 * One topic, a row: its name and the "?" with how we know; then each
 * address or number it has an answer for, by email before phone, with that
 * answer in its words and colour; then why, once if every answer has the
 * same reason, else under each. A blocked address is a no like any other,
 * its reason what blocked it.
 */
function TopicRow({ topic, permissions }: { topic: Topic; permissions: ContactPermission[] }) {
  const id = `why-${topic}`;
  const name = copy.topics[permissions[0].channel][topic];
  const reasons = permissions.map(permissionReason);
  const blocked = permissions.map((permission) => permission.reason === "blocked");
  // A blocked address's reason is never another's, so those that share one are all blocked or none is.
  const shared = reasons.every((r) => r === reasons[0]);
  return (
    <li className={styles.item}>
      <span className={styles.head}>
        <span className={styles.topic}>{name}</span>
        <button type="button" className={styles.help} aria-label={copy.why} {...bubbleTrigger(id)}>
          ?
        </button>
      </span>
      {permissions.map((permission, i) => (
        <span key={`${permission.channel}-${permission.address}`} className={styles.answer} data-send={permission.send}>
          <span className={styles.line}>
            <Address channel={permission.channel} address={permission.address} link={permission.send !== "no"} />
            <Tag tone={TONES[permission.send]}>{copy.answers[waysKey(permission.channel, topic)][permission.send]}</Tag>
          </span>
          {!shared && <Reason words={reasons[i]} blocked={blocked[i]} />}
        </span>
      ))}
      {shared && <Reason words={reasons[0]} blocked={blocked[0]} />}
      <BubbleBox id={id} className={styles.popover}>
        <TopicDetails topic={topic} channels={[...new Set(permissions.map((p) => p.channel))]} name={name} />
      </BubbleBox>
    </li>
  );
}

/** The topics in the order the rows go: ours first, then Luma's, then the rest. */
const ORDER: Topic[] = ["site-forms", "luma-calendar", "pauseai-updates", "volunteering", "march-day"];

/**
 * Whether we'd contact a supporter about each topic, a row each, every
 * address and number it has an answer for in it, email before phone.
 */
export default function PermissionTiles({ permissions }: { permissions: ContactPermission[] }) {
  const byChannel = (a: ContactPermission, b: ContactPermission) =>
    CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel);
  return (
    <ul className={styles.list}>
      {ORDER.flatMap((topic) => {
        const own = permissions.filter((p) => p.topic === topic).sort(byChannel);
        return own.length > 0 ? [<TopicRow key={topic} topic={topic} permissions={own} />] : [];
      })}
    </ul>
  );
}
