import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import { CONSENTS, type ContactPermission, type Topic, type Way } from "@/lib/contact-permissions";
import { hold, isNumber, LINK_DAYS, type SettingsChoice, type SettingsView } from "@/lib/email-settings";
import { now } from "@/lib/now";
import { siteUrl, siteUrlIfKnown } from "@/lib/site-url";
import { queueBulkLift } from "./civicrm-updates";
import { config } from "./config";
import { query, transaction, type Queryable } from "./db";
import { send } from "./email-sending";
import {
  hasOptedOut,
  liftStopAllNumbers,
  recordBulkLift,
  recordOptOut,
  recordResubscribe,
  normaliseAddress,
  offCalendarFor,
  STOP_ALL,
  stopAllGroup,
  type CalendarOptOut,
  type OptOutSource,
} from "./opt-outs";
import { removeCalendarContact } from "./outside-services/luma-calendar";
import { randomId } from "./random-id";
import { notifyDomain } from "./outside-services/postmark";
import { problem } from "./problems";

// The contact preferences page (/contact-preferences), where anyone sees and changes
// what PauseAI UK sends an address, and why. It opens only from a link
// emailed to the address: one asked for on the page, which works for
// LINK_DAYS, or the unsubscribe link in a copy of a broadcast, whose button
// that opts out of what the copy went under works forever, and whose page
// works for PAGE_DAYS after it went; or, for a number alone, from the link
// in the answer to a stop in WhatsApp (newNumberLink). So a box ticked there
// is the address's or number's owner saying yes: a yes from the page
// (preference_choices), with the words beside it. An untick is an opt-out from the page. Turning off events
// by email, or every bulk email, takes the address off our Luma calendar
// too, on the live site.

/** How long the page works from a copy's unsubscribe link, after the copy went. */
const PAGE_DAYS = 30;
/** How long a link for a number works, as no fresh one can be emailed to it. */
const NUMBER_LINK_DAYS = 30;
/** How soon after one link the same address can be sent another. */
const RESEND_MINUTES = 2;
/** How many links an address can be sent in a day, however they're asked for. */
const LINKS_A_DAY = 5;

const copy = emailSettingsCopy;

/** What's kept of a link's token: its hash, so the database alone can't open anyone's page. */
export const hashOf = (token: string): string => createHash("sha256").update(token).digest("hex");

/**
 * A new link to the page for a number alone, its texts and calls, working
 * for NUMBER_LINK_DAYS: its path. Sent only to the number, in answer to a
 * stop, so it proves the number is theirs.
 */
export function newNumberLink(number: string): Promise<string> {
  return newSettingsLink(number, undefined, NUMBER_LINK_DAYS);
}

/** A new link to the page for `address`, working for LINK_DAYS, or `days`: its path. */
export async function newSettingsLink(address: string, db?: Queryable, days = LINK_DAYS): Promise<string> {
  const to = normaliseAddress(address);
  // The address and how many it's had: a different seed for each link.
  const token = (
    await randomId(24, async () => {
      const [{ count }] = await query<{ count: number }>(
        "SELECT count(*)::int AS count FROM preference_links WHERE address = $1",
        [to],
        db,
      );
      return `settings ${to} ${count}`;
    })
  ).toString("base64url");
  await query(
    `INSERT INTO preference_links (token_hash, address, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashOf(token), to, days],
    db,
  );
  return `/contact-preferences/${token}`;
}

/**
 * The title of the broadcast a fixture build makes a copy under, for an
 * address that was sent none under `topic`; `old`, one sent too long ago for
 * more than its button, as a supporter has one copy of each broadcast.
 */
export const devBroadcastTitle = (topic: Topic, old = false): string =>
  `Dev: ${topic} unsubscribe link${old ? ", old" : ""}`;

/** How long before now a copy made for an old email's link went: past PAGE_DAYS, so only its button works. */
const OLD_DAYS = PAGE_DAYS + 10;

/**
 * A new unsubscribe link for the latest copy of an email broadcast to
 * `address` under `topic`, or, `old`, for one sent more than PAGE_DAYS ago,
 * as its email carries one: its path. With no such copy, it makes one, sent
 * now or OLD_DAYS ago, under a broadcast for the purpose
 * (devBroadcastTitle), once for each topic; undefined for an address no
 * supporter has. Its copy's old token stops working, so it's only for a
 * fixture build (app/(staff)/staff/api/dev-contact-preferences).
 */
export async function newTopicLink(address: string, topic: Topic, old = false): Promise<string | undefined> {
  const to = normaliseAddress(address);
  return transaction(async (db) => {
    const [found] = await query<{ id: number }>(
      `SELECT c.id::int AS id FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
       WHERE c.address = $1 AND m.channel = 'email' AND $2 = ANY (c.topics) AND c.sent_at IS NOT NULL
         AND (NOT $3 OR c.sent_at < now() - make_interval(days => $4))
       ORDER BY c.sent_at DESC, c.id DESC LIMIT 1`,
      [to, topic, old, PAGE_DAYS],
      db,
    );
    const id = found?.id ?? (await devCopy(to, topic, old, db));
    if (id === undefined) return undefined;
    const token = (await randomId(18, () => `copy link ${id}`)).toString("base64url");
    await query("UPDATE broadcast_messages SET link_token_hash = $2 WHERE id = $1", [id, hashOf(token)], db);
    return `/contact-preferences/m/${token}`;
  });
}

/**
 * A copy sent to `address` under the dev broadcast for `topic`, now or,
 * `old`, OLD_DAYS ago, made if there's none yet; undefined for an address
 * no supporter has.
 */
async function devCopy(address: string, topic: Topic, old: boolean, db: Queryable): Promise<number | undefined> {
  const [supporter] = await query<{ id: number }>(
    "SELECT supporter_id::int AS id FROM supporter_links WHERE matched_by = 'email' AND matched_value = $1 LIMIT 1",
    [address],
    db,
  );
  if (!supporter) return undefined;
  const title = devBroadcastTitle(topic, old);
  const [made] = await query<{ id: number }>(
    `WITH found AS (SELECT id FROM mailings WHERE audience = 'supporters' AND title = $1),
     made AS (
       INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name,
         due_at, state)
       SELECT $1, $1, 'supporters', 'email', $2, '{"list": "supporters", "params": {}}', '{"type": "doc", "content": []}',
         'dev@pauseai.uk', 'hello@pauseai.uk', 'PauseAI UK', now(), 'sent'
       WHERE NOT EXISTS (SELECT 1 FROM found) RETURNING id)
     INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, topics, sent_at)
     SELECT id, $3, $4, 'sent', ARRAY[$2], now() - make_interval(days => $5)
     FROM (SELECT id FROM found UNION ALL SELECT id FROM made) m
     RETURNING id::int AS id`,
    [title, topic, supporter.id, address, old ? OLD_DAYS : 0],
    db,
  );
  return made.id;
}

/** Whether we have the address from anywhere: someone we know, or an opt-out of theirs. */
async function known(address: string): Promise<boolean> {
  const [row] = await query(
    `SELECT 1 WHERE EXISTS (SELECT 1 FROM supporter_links WHERE matched_by = 'email' AND matched_value = $1)
       OR EXISTS (SELECT 1 FROM civicrm_contacts WHERE email = $1)`,
    [address],
  );
  return Boolean(row) || (await hasOptedOut(address));
}

/**
 * Emails `address` a link to the page, if we have the address and haven't
 * sent it one in the last few minutes, nor LINKS_A_DAY in the last day.
 * Says nothing either way, so the page can't be used to learn whose
 * addresses we hold.
 */
export async function emailSettingsLink(address: string, request?: Request): Promise<void> {
  const to = normaliseAddress(address);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !(await known(to))) return;
  const [{ recent, today }] = await query<{ recent: boolean; today: number }>(
    `SELECT coalesce(bool_or(created_at > now() - make_interval(mins => $2)), false) AS recent, count(*)::int AS today
     FROM preference_links WHERE address = $1 AND created_at > now() - interval '1 day'`,
    [to, RESEND_MINUTES],
  );
  if (recent || today >= LINKS_A_DAY) return;
  const link = siteUrl(await newSettingsLink(to), request).toString();
  await send(
    {
      From: `${copy.fromName} <hello@${notifyDomain()}>`,
      To: to,
      Subject: copy.linkEmail.subject,
      TextBody: copy.linkEmail.body(link, LINK_DAYS),
    },
    "preferences-link",
  );
}

/** What a link opens: the page for an address, or, when it's run out, which address to send a fresh one to. */
export type SettingsLink = { address: string; open: boolean };

/** The address a link asked for is for, and whether it still works; undefined for no such link. */
async function settingsLink(token: string): Promise<SettingsLink | undefined> {
  const [link] = await query<SettingsLink>(
    "SELECT address, expires_at > now() AS open FROM preference_links WHERE token_hash = $1",
    [hashOf(token)],
  );
  return link;
}

/** A copy of a broadcast, as its unsubscribe link finds it. */
export type CopyLink = {
  messageId: number;
  address: string;
  /** What it went under, which its button opts out of. */
  topics: Topic[];
  /** Whether the rest of the page still works, PAGE_DAYS after it went. */
  open: boolean;
};

/** The copy an unsubscribe link is in, by the link's token; undefined for none, or one whose address was erased. */
async function copyLink(token: string): Promise<CopyLink | undefined> {
  const [found] = await query<CopyLink>(
    `SELECT id::int AS "messageId", address, topics,
       coalesce(sent_at, now()) > now() - make_interval(days => $2) AS open
     FROM broadcast_messages WHERE link_token_hash = $1 AND address IS NOT NULL`,
    [hashOf(token), PAGE_DAYS],
  );
  return found;
}

/** The numbers of whoever has the address, as phone_number() writes them. */
async function numbersOf(address: string): Promise<string[]> {
  const rows = await query<{ phone: string }>(
    `SELECT DISTINCT phone_number(c.phone) AS phone FROM supporter_contact c
     WHERE c.supporter_id IN (SELECT supporter_id FROM supporter_links WHERE matched_by = 'email' AND matched_value = $1)
       AND phone_number(c.phone) LIKE '+%'
     ORDER BY 1`,
    [address],
  );
  return rows.map((row) => row.phone);
}

/** Every consent's answer for the address, if any, and each number by text and call, whatever has an answer. */
async function answersFor(address: string | null, numbers: string[]): Promise<ContactPermission[]> {
  return query<ContactPermission>(
    `SELECT c.topic, c.way, CASE WHEN c.way = 'email' THEN 'email' ELSE 'phone' END AS channel, a.address,
       d.send, d.reason, d.at, d.source
     FROM unnest($1::text[], $2::text[]) c (topic, way)
       JOIN (SELECT $3::text AS address, 'email' AS way WHERE $3 IS NOT NULL
             UNION ALL SELECT n, 'phone' FROM unnest($4::text[]) n) a
         ON (a.way = 'email') = (c.way = 'email')
       CROSS JOIN LATERAL contact_permission(c.topic, c.way, a.address) d`,
    [CONSENTS.map((c) => c.topic), CONSENTS.map((c) => c.way), address, numbers],
  );
}

/**
 * What the page shows for an address: its numbers, and each consent's
 * answer, and what stops all its email. For a number, the number alone, and
 * its answers by text and call.
 */
export async function settingsFor(address: string): Promise<SettingsView> {
  const to = normaliseAddress(address);
  if (isNumber(to)) return { address: to, numbers: [to], answers: await answersFor(null, [to]), hold: null };
  const numbers = await numbersOf(to);
  const answers = await answersFor(to, numbers);
  const held = hold(answers);
  return { address: to, numbers, answers, hold: held && { ...held, everything: (await stopAllGroup(to)) !== null } };
}

/** The live calendar, which only the live site changes; a fixture build's is fake. */
const mayChangeLuma = (): boolean => config.production || config.fixtures;

/**
 * Takes the address off our Luma calendar, if this build may; a failure is
 * reported, not thrown, and the next full pass over the calendar's contacts
 * tries again (stillOnCalendar).
 */
export async function offCalendar(address: string): Promise<void> {
  if (!mayChangeLuma()) return;
  try {
    await removeCalendarContact(address);
  } catch (error) {
    problem(staffCopy.problems.logs.lumaRemoveFailed, error);
  }
}

/**
 * Takes off our Luma calendar each address of `optOuts`, just recorded,
 * whose opt-out does (offCalendarFor), once each. Every path that records
 * opt-outs calls it, once they're kept.
 */
export async function offCalendarAfter(optOuts: CalendarOptOut[]): Promise<void> {
  const addresses = new Set(optOuts.filter(offCalendarFor).map((optOut) => normaliseAddress(optOut.address)));
  for (const address of addresses) await offCalendar(address);
}

/**
 * An opt-out from the page, or from a copy's link or a mail app's button,
 * now. Each is its own, so one after a yes since is kept, however many came
 * from the same copy before.
 */
async function optOut(
  address: string,
  way: Way,
  list: Topic | "bulk",
  source: OptOutSource,
  db: Queryable,
  messageId?: number,
): Promise<boolean> {
  return recordOptOut(
    {
      address,
      way,
      list,
      source,
      sourceRef: `${source} ${randomUUID()}`,
      unsubscribedAt: now(),
      ...(messageId && { messageId }),
    },
    db,
  );
}

/** A yes from the page, with the words beside its box; it closes any opt-out of the same before it. */
async function chooseYes(address: string, way: Way, topic: Topic, db: Queryable): Promise<void> {
  await query(
    "INSERT INTO preference_choices (address, way, topic, wording) VALUES ($1, $2, $3, $4)",
    [address, way, topic, copy.wording(topic, way)],
    db,
  );
  await recordResubscribe(address, topic, now(), db, way);
}

/**
 * Saves what's ticked on the page for the address and its numbers, as a set
 * of `choiceKey`s: a box newly ticked is a yes, one newly unticked an
 * opt-out. A text or call box stands for every number, ticked where any
 * says yes (settingsTopics): ticking it is a yes for each number without
 * one, unticking it an opt-out for each with one, and leaving it as it was
 * changes none. Nothing for email while all its email is held, nor on a
 * number's page, nor any box the page didn't offer. Returns what changed.
 */
export async function saveSettings(address: string, ticked: Set<string>): Promise<SettingsChoice[]> {
  const view = await settingsFor(address);
  const changed: SettingsChoice[] = [];
  await transaction(async (db) => {
    for (const { topic, way } of CONSENTS) {
      if (way === "email" && (view.hold || isNumber(view.address))) continue;
      const targets = way === "email" ? [view.address] : view.numbers;
      if (targets.length === 0) continue;
      const yes = (target: string) =>
        view.answers.some((a) => a.topic === topic && a.way === way && a.address === target && a.send === "yes");
      const want = ticked.has(`${topic}:${way}`);
      if (targets.some(yes) === want) continue;
      for (const target of targets.filter((one) => yes(one) !== want)) {
        if (want) await chooseYes(target, way, topic, db);
        else await optOut(target, way, topic, "preferences", db);
      }
      changed.push({ topic, way, on: want });
    }
  });
  await offCalendarAfter(
    changed
      .filter((c) => !c.on)
      .map((c) => ({ address: view.address, way: c.way, list: c.topic, source: "preferences" })),
  );
  return changed;
}

/**
 * Lifts "No bulk emails" for the address, as the person chose beside the
 * page's words for it: closes our opt-out of every bulk email, and tells
 * CiviCRM, which turns PauseAI Global's bulk email back on too. Where Stop
 * everything set it, it undoes that in full, closing the stops it made of
 * texts and calls too. Nothing while "Do not email" stands, which only
 * Global can lift.
 */
export async function liftNoBulk(address: string): Promise<boolean> {
  const view = await settingsFor(address);
  if (view.hold?.kind !== "no-bulk") return false;
  const wording = view.hold.everything ? copy.stopped.wording : copy.noBulk.wording;
  await transaction(async (db) => {
    const group = await stopAllGroup(view.address, db);
    if (group) await liftStopAllNumbers(group, db);
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO preference_choices (address, way, topic, wording) VALUES ($1, 'email', 'bulk', $2)
       RETURNING id::int AS id`,
      [view.address, wording],
      db,
    );
    await recordBulkLift(view.address, db);
    await queueBulkLift({ id, address: view.address, at: now(), wording }, db);
  });
  return true;
}

/**
 * Opts the address out of every bulk email, which CiviCRM is told of, and
 * each of its numbers out of every text and every call (`all`), whatever it
 * has a yes for now or later, which CiviCRM is told of as "Do not SMS" and
 * "Do not phone"; and takes the address off our Luma calendar. The stops are one group, by
 * their source reference (STOP_ALL), so Restart can undo them all. Nothing
 * for a number's page, which doesn't offer it.
 */
export async function stopEverything(address: string): Promise<void> {
  if (isNumber(normaliseAddress(address))) return;
  const view = await settingsFor(address);
  const group = `${STOP_ALL} ${randomUUID()}`;
  const stop = (target: string, way: Way, list: "bulk" | "all", db: Queryable) =>
    recordOptOut(
      {
        address: target,
        way,
        list,
        source: "preferences",
        sourceRef: `${group} ${way} ${list} ${target}`,
        unsubscribedAt: now(),
      },
      db,
    );
  await transaction(async (db) => {
    await stop(view.address, "email", "bulk", db);
    for (const number of view.numbers) {
      await stop(number, "text", "all", db);
      await stop(number, "call", "all", db);
    }
  });
  await offCalendarAfter([{ address: view.address, list: "bulk", source: "preferences" }]);
}

/**
 * Opts a copy's address out of what the copy went under, by its unsubscribe
 * link's button (`link`) or a mail app's own Unsubscribe (`list-unsubscribe`);
 * events by email takes it off our Luma calendar too. Works however long ago
 * the copy went. Says whether there was such a copy.
 */
export async function unsubscribeCopy(token: string, source: "link" | "list-unsubscribe"): Promise<boolean> {
  const found = await copyLink(token);
  if (!found) return false;
  await transaction(async (db) => {
    for (const topic of found.topics) await optOut(found.address, "email", topic, source, db, found.messageId);
  });
  await offCalendarAfter(found.topics.map((list) => ({ address: found.address, list, source })));
  return true;
}

/** How a page was opened: by a link asked for on the page, or by a copy's unsubscribe link. */
export type SettingsKind = "link" | "copy";

/** What a page shows: what its link's copy went under, for the unsubscribe box; and the settings, or null once its link has run out. */
export type SettingsPageState = {
  kind: SettingsKind;
  token: string;
  /** Whether the link is for a number alone, to which no fresh link can be emailed. */
  number: boolean;
  unsubscribe: Topic[] | null;
  view: SettingsView | null;
};

/** The page a link asked for opens; undefined for no such link. */
export async function linkPage(token: string): Promise<SettingsPageState | undefined> {
  const link = await settingsLink(token);
  if (!link) return undefined;
  return {
    kind: "link",
    token,
    number: isNumber(link.address),
    unsubscribe: null,
    view: link.open ? await settingsFor(link.address) : null,
  };
}

/** The page a copy's unsubscribe link opens; undefined for no such copy. */
export async function copyPage(token: string): Promise<SettingsPageState | undefined> {
  const found = await copyLink(token);
  if (!found) return undefined;
  return {
    kind: "copy",
    token,
    number: false,
    unsubscribe: found.topics,
    view: found.open ? await settingsFor(found.address) : null,
  };
}

/** The address a page's link is for, while the page works; undefined once it's run out, or for no such link. */
export async function openAddress(kind: SettingsKind, token: string): Promise<string | undefined> {
  if (kind === "link") {
    const link = await settingsLink(token);
    return link?.open ? link.address : undefined;
  }
  const found = await copyLink(token);
  return found?.open ? found.address : undefined;
}

/** Emails a fresh link to the address a page's link was for, however long ago, as emailSettingsLink does. */
export async function resendLink(kind: SettingsKind, token: string, request?: Request): Promise<void> {
  const address = kind === "link" ? (await settingsLink(token))?.address : (await copyLink(token))?.address;
  if (address) await emailSettingsLink(address, request);
}

/** How long after one notice of "No bulk emails" the same address can be sent another. */
export const NOTICE_DAYS = 30;

/**
 * Emails the person on a form entry who ticked its box to hear from us but
 * has "No bulk emails", once a sign-up, and once in NOTICE_DAYS however many
 * they make: what happened, where (`where`, in the person's words), and a
 * link to lift it. Nobody with "Do not email", nor a blocked address, gets
 * it, nor anyone with no hold. Says whether it sent. A failure is reported,
 * not thrown, so the sign-up it follows goes on.
 */
export async function sendBulkNotice(entryId: number, where: string, request?: Request): Promise<boolean> {
  try {
    return await bulkNotice(entryId, where, request);
  } catch (error) {
    problem(staffCopy.problems.anywhere.sendFailed("bulk-notice"), error);
    return false;
  }
}

async function bulkNotice(entryId: number, where: string, request?: Request): Promise<boolean> {
  // A build that doesn't know its own address, as a local one may not, can't link to the page.
  const site = siteUrlIfKnown("/", request);
  if (!site) return false;
  const [entry] = await query<{ email: string }>(
    `UPDATE form_entries f SET bulk_notice_at = now()
     WHERE f.id = $1 AND f.contact_consent AND f.bulk_notice_at IS NULL
       AND EXISTS (SELECT 1 FROM contact_permission('newsletter', 'email', lower(trim(f.email))) d
                   WHERE d.reason = 'no-bulk-email')
       AND NOT EXISTS (SELECT 1 FROM email_sends s WHERE s.purpose = 'bulk-notice' AND s.address = lower(trim(f.email))
                       AND s.at > now() - make_interval(days => $2))
     RETURNING lower(trim(f.email)) AS email`,
    [entryId, NOTICE_DAYS],
  );
  if (!entry) return false;
  const link = new URL(await newSettingsLink(entry.email), site).toString();
  const sent = await send(
    {
      From: `${copy.fromName} <hello@${notifyDomain()}>`,
      To: entry.email,
      Subject: copy.bulkNotice.subject,
      TextBody: copy.bulkNotice.body(where, link, LINK_DAYS),
    },
    "bulk-notice",
  );
  return sent.sent;
}
