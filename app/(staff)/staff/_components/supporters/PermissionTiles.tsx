import { useId } from "react";
import ExternalLink from "../ui/ExternalLink";
import StaffLink from "../ui/StaffLink";
import {
  LIST_TOPICS,
  lumaOnly,
  LISTS,
  WAYS,
  type Channel,
  type ContactPermission,
  type List,
  type Way,
} from "@/lib/supporters/contact-permissions";
import { phoneWords } from "@/lib/phone";
import { staffDate } from "@/lib/staff-time";
import ChannelIcon from "@/components/ui/ChannelIcon";
import Tag from "@/components/ui/Tag";
import { BubbleBox } from "@/components/ui/Bubble";
import { bubbleTrigger } from "@/components/ui/bubble-trigger";
import styles from "./PermissionTiles.module.css";
import { supportersCopy } from "./copy";

const copy = supportersCopy.supporters.detail.permissions;

/**
 * The short reason for an answer, with when and where it came from. A
 * blocked address's is what blocked it, or nothing for a cause the copy has
 * no words for.
 */
export function permissionReason(permission: ContactPermission): string {
  const when = permission.at ? staffDate(permission.at) : "";
  if (permission.reason === "blocked") return copy.blockedBecause[permission.source ?? ""]?.(when) ?? "";
  const source = copy.sources[permission.source ?? ""] ?? copy.otherSource;
  return copy.reasons[permission.reason](when, source, permission.topic);
}

/**
 * A list's name where a person's lists are shown: inc. Luma there is only
 * where Luma alone reaches them (lumaOnly), so it has a name of its own
 * for that (copy.lumaOnly).
 */
export function personListName(list: List): string {
  return list === "updates-luma" ? copy.lumaOnly.name : supportersCopy.supporters.filters.lists[list];
}

/**
 * What's behind a list's "?": its name, who it's for, then what put them on
 * it, for a list that says; on a person's (`person`), Luma only's, for inc. Luma.
 */
function ListDetails({ list, person = false }: { list: List; person?: boolean }) {
  const name = person ? personListName(list) : supportersCopy.supporters.filters.lists[list];
  const details = person && list === "updates-luma" ? copy.lumaOnly : copy.details[list];
  return (
    <>
      <strong className={styles.topicTitle}>{copy.topicTitle(name)}</strong>
      <p>{details.about}</p>
      {details.on.length > 0 && (
        <>
          <p className={styles.whoIsOn}>{copy.whoIsOn}</p>
          <ul className={styles.on}>
            {details.on.map((one) => (
              <li key={one}>{one}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * A "?" that opens what one list means, as its row's "?" says it, beside
 * where it's chosen: a broadcast's list, and each in the Consent filter's
 * menus. Each has its own bubble, as one list can be in several menus at once.
 */
export function ListHelp({ list }: { list: List }) {
  const id = `list-help-${useId()}`;
  return (
    <>
      <button
        type="button"
        className={styles.help}
        aria-label={copy.listHelp(supportersCopy.supporters.filters.lists[list])}
        {...bubbleTrigger(id)}
      >
        ?
      </button>
      <BubbleBox id={id} className={styles.popover}>
        <ListDetails list={list} />
      </BubbleBox>
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

/** Why an answer is what it is; after a blocked address's, the link to Blocked addresses. */
function Reason({ permission }: { permission: ContactPermission }) {
  const words = permissionReason(permission);
  const blocked = permission.reason === "blocked";
  return (
    <span className={styles.reason}>
      {blocked && words ? `${words} · ` : words}
      {blocked && <StaffLink href="/staff/supporters/blocked-addresses">{copy.seeBlocked}</StaffLink>}
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
 * A list's answer for each way and address or number: its topic's; for
 * PauseAI UK Updates inc. Luma, only where Luma alone reaches them (lumaOnly),
 * as elsewhere it says no more than Updates' row does, and where it would
 * but for a no: one to events by a way and address Updates has no answer
 * for, such as an opt-out or a block, so what stopped it shows. Not that
 * they never followed the calendar, as Luma never reached them.
 */
function listAnswers(list: List, permissions: ContactPermission[]): ContactPermission[] {
  if (list !== "updates-luma") return permissions.filter((p) => p.topic === LIST_TOPICS[list][0]);
  const updates = (p: ContactPermission) =>
    permissions.some((n) => n.topic === "newsletter" && n.way === p.way && n.address === p.address);
  const stopped = (p: ContactPermission) =>
    p.topic === "events" && p.send === "no" && p.reason !== "not-following" && !updates(p);
  return [...lumaOnly(permissions), ...permissions.filter(stopped)];
}

/**
 * One list, a row: its name and the "?" with what it is; then each way and
 * address or number it has an answer for, email first, then texts, then
 * calls, with that answer in its words, green for a yes, and under it why,
 * where from and when. A number that can be texted and called alike, or
 * neither, for the same reason, has one line for both, a lozenge each.
 */
function ListRow({ list, permissions }: { list: List; permissions: ContactPermission[] }) {
  const id = `why-${list}`;
  return (
    <li className={styles.item}>
      <span className={styles.head}>
        <span className={styles.topic}>{personListName(list)}</span>
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
        <ListDetails list={list} person />
      </BubbleBox>
    </li>
  );
}

/**
 * Whether we'd contact a supporter on each list, a row each, every address
 * and number it has an answer for in it, by email, then text, then call;
 * then, for someone on our Luma calendar (`onLuma`), that they are, as
 * Luma's own messages go to them.
 */
export default function PermissionTiles({
  permissions,
  onLuma = false,
}: {
  permissions: ContactPermission[];
  onLuma?: boolean;
}) {
  const byWay = (a: ContactPermission, b: ContactPermission) => WAYS.indexOf(a.way) - WAYS.indexOf(b.way);
  return (
    <ul className={styles.list}>
      {LISTS.flatMap((list) => {
        const own = listAnswers(list, permissions).sort(byWay);
        return own.length > 0 ? [<ListRow key={list} list={list} permissions={own} />] : [];
      })}
      {onLuma && (
        <li className={styles.item}>
          <span className={styles.head}>
            <span className={styles.topic}>{copy.luma.name}</span>
          </span>
          <span className={styles.answer} data-send="yes">
            <span className={styles.line}>
              <span className={styles.reason}>{copy.luma.on}</span>
            </span>
          </span>
        </li>
      )}
    </ul>
  );
}
