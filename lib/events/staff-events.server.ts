import "server-only";
import { ruleOwner } from "./owners";
import { listEvents } from "./staff-events-list.server";
import { londonStart } from "@/lib/staff-time";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction, type Queryable } from "@/lib/server/db.server";
import { send } from "@/lib/email/sending.server";
import { notifyDomain } from "@/lib/server/outside-services/postmark.server";
import { replyToAll, staffLink } from "@/lib/email/notifications.server";
import { staffAddressLine } from "@/lib/email/staff-address.server";
import { eventsCopy } from "./copy";

// Who on staff owns each of our events on Luma (event_owners), and the link
// to its Google Doc (event_docs), which anyone can set. Only our own events:
// one another calendar runs and ours lists isn't ours to own. When an owner
// changes, the new owner is emailed, copied to the one before, saying who
// gave it to them. The events page's list is ./staff-events-list.server.ts.

/** What saving an event's edit form did, for the page to say: whom it emailed, and its owner as chosen. */
export type EventSaved = { emailed: string[]; owner: string | null };

/**
 * Emails `owner` that they own `ids` now, whoever chose them, copied to
 * `previous`, the owner before, saying `by` gave it to them; or with no
 * `by`, that the rules did. A reply goes to them both; to one alone, it
 * has no Reply-To, as there's no one else for it to reach. It links to the staff events page: for one
 * event, searched for it, which also suits the owner before, Cc'd; for
 * several, filtered to the owner. Returns whom it emailed, none if it
 * wasn't sent.
 */
async function tellOwner(
  owner: string,
  ids: string[],
  by: string | null,
  previous: string | null = null,
): Promise<string[]> {
  const to = owner;
  const cc = previous && previous !== owner ? previous : null;
  const events = await listEvents(ids);
  const copy = eventsCopy.events.ownerEmail;
  const filter = events.length === 1 ? ["q", events[0].name] : ["owner", owner];
  const link = staffLink(`/staff/events?${new URLSearchParams([filter])}`, undefined);
  const toLine = await staffAddressLine(to);
  const ccLine = cc && (await staffAddressLine(cc));
  const result = await send(
    {
      From: `PauseAI UK <noreply@${notifyDomain()}>`,
      To: toLine,
      ...(ccLine ? { Cc: ccLine, ReplyTo: replyToAll(toLine, ccLine) } : {}),
      Subject: copy.subject(events.length, events[0].name, owner),
      TextBody: copy.body({
        events: events.map((event) => ({ name: event.name, when: londonStart(event.startAt), url: event.url })),
        owner,
        previous,
        by,
        link,
      }),
      Tag: "staff-alert",
    },
    "staff-alert",
  );
  return result.sent ? [to, ...(cc ? [cc] : [])] : [];
}

/**
 * Makes `owner` the owner of one of our events, as `by`, in the audit log,
 * and emails them and the owner before (tellOwner). Nothing for an event
 * not ours, an address with no staff account, or the owner it has.
 * Returns whom it emailed, or undefined if nothing changed.
 */
export async function setEventOwner(eventId: string, owner: string, by: string): Promise<string[] | undefined> {
  const previous = await transaction(async (db) => {
    const [event] = await query<{ previous: string | null }>(
      `SELECT o.owner AS previous FROM luma_events e LEFT JOIN event_owners o ON o.event_id = e.id
       WHERE e.id = $1 AND e.access = 'manage' FOR UPDATE OF e`,
      [eventId],
      db,
    );
    const [account] = await query("SELECT 1 FROM staff_accounts WHERE email = $1", [owner], db);
    if (!event || !account || event.previous === owner) return undefined;
    await query(
      `INSERT INTO event_owners (event_id, owner, assigned_by) VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO UPDATE SET owner = EXCLUDED.owner, assigned_by = EXCLUDED.assigned_by, assigned_at = now()`,
      [eventId, owner, by],
      db,
    );
    await logChange(by, "set event owner", { eventId, owner, previous: event.previous }, db);
    return { was: event.previous };
  });
  if (!previous) return undefined;
  return tellOwner(owner, [eventId], by, previous.was);
}

/**
 * Sets the link to one of our events' Google Doc, as `by`, in the audit
 * log; null clears it. Nothing for an event not ours, or the link it has.
 * Returns whether it changed.
 */
export async function setEventDoc(eventId: string, url: string | null, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [event] = await query<{ previous: string | null }>(
      `SELECT d.url AS previous FROM luma_events e LEFT JOIN event_docs d ON d.event_id = e.id
       WHERE e.id = $1 AND e.access = 'manage' FOR UPDATE OF e`,
      [eventId],
      db,
    );
    if (!event || event.previous === url) return false;
    if (url) {
      await query(
        `INSERT INTO event_docs (event_id, url, set_by) VALUES ($1, $2, $3)
         ON CONFLICT (event_id) DO UPDATE SET url = EXCLUDED.url, set_by = EXCLUDED.set_by, set_at = now()`,
        [eventId, url, by],
        db,
      );
    } else {
      await query("DELETE FROM event_docs WHERE event_id = $1", [eventId], db);
    }
    await logChange(by, "set event doc", { eventId, url, previous: event.previous }, db);
    return true;
  });
}

/** Who gives an event its owner by the rules, in event_owners and the audit log: the import, as for any sync. */
const RULES = "sync";

/**
 * Gives each of our events still to come that has no owner its owner by
 * the rules (lib/events/owners.ts), if they have a staff account; one
 * without stays with none, for staff to see. Returns, for each new owner,
 * the IDs of the events they were given, for ownerEmails() once the
 * transaction is done.
 */
export async function assignRuleOwners(db: Queryable): Promise<Map<string, string[]>> {
  const events = await query<{ id: string; city: string | null; tags: string[] }>(
    `SELECT e.id, e.city, e.tags FROM luma_events e
     WHERE e.access = 'manage' AND e.removed_at IS NULL AND e.start_at > now()
       AND NOT EXISTS (SELECT 1 FROM event_owners o WHERE o.event_id = e.id)
     ORDER BY e.start_at, e.id`,
    [],
    db,
  );
  const given = new Map<string, string[]>();
  for (const event of events) {
    const owner = ruleOwner(event);
    const rows = await query(
      `INSERT INTO event_owners (event_id, owner, assigned_by)
       SELECT $1, email, $3 FROM staff_accounts WHERE email = $2
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [event.id, owner, RULES],
      db,
    );
    if (!rows.length) continue;
    await logChange(RULES, "set event owner", { eventId: event.id, owner, previous: null }, db);
    given.set(owner, [...(given.get(owner) ?? []), event.id]);
  }
  return given;
}

/** Emails each owner the rules gave events to, once, listing them. */
export async function ownerEmails(given: Map<string, string[]>): Promise<void> {
  for (const [owner, ids] of given) await tellOwner(owner, ids, null);
}
