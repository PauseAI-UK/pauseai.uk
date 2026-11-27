import "server-only";
import { OPT_OUT_RECORDED } from "./opt-outs.server";
import { MP_CHOICES } from "./mp-choices.server";
import { cache } from "react";
import { windowStart } from "@/lib/time-windows";
import { now } from "@/lib/now";
import type {
  NegatableSupporterFilter,
  SupporterActivity,
  SupporterBadge,
  SupporterContact,
  SupporterDetails,
  SupporterMp,
  SupporterFilter,
  SupporterGroupTown,
  SupporterIdentity,
  SupporterLetter,
  SupporterRow,
  SupporterSummary,
} from "./supporters";
import { MARCH_SOURCES, SUPPORTERS_PAGE_SIZE } from "./supporters";
import { channelOf, type Channel, type ContactPermission } from "./contact-permissions";
import { query, transaction, type Queryable } from "@/lib/server/db.server";
import { permissionsFor } from "./permissions-for.server";
import { lumaCalendarAnswers, optedOutOfLuma } from "./opt-outs.server";
import { refreshSupporterFacts, refreshSupportersList } from "./facts.server";
import { SUPPORTER_SOURCES } from "./sources.server";
import { contains, everyWord, phoneSearch } from "@/lib/server/search.server";
import { proxyTag } from "@/lib/letters/letters-inbox.server";
import { sql, type Sql } from "@/lib/server/sql.server";
import { placeFor, type FoundPlace } from "@/lib/server/outside-services/postcodes.server";
import { REPLIES } from "@/lib/letters/reply-count.server";

// Supporters: one per person, tied to each record about them in a source
// (supporter_links). Linking is by email, trimmed and lowercased and
// nothing more: jane+luma@ and jane@ are two people. A WhatsApp entry, which
// has no email, links by its number. It only adds links,
// so running it again does nothing, and a Luma user who changes their
// email stays linked by user ID. Then two supporters who gave the same UK
// mobile number, or the same number in a WhatsApp entry, are one, merged
// into the older (merge_supporters_by_phone()); the other's ID still
// finds them.

export type LinkResult = { supportersAdded: number; linked: number };

/** Every source record with an email and no link yet, as one table of candidates. */
const CANDIDATES = SUPPORTER_SOURCES.map(
  ({ name, column }) =>
    `SELECT ${SUPPORTER_SOURCES.map((s) => (s.column === column ? `s.source_id AS ${s.column}` : `NULL::${s.type} AS ${s.column}`)).join(", ")}, s.email
     FROM supporter_source_${name} s
     WHERE s.email <> '' AND NOT EXISTS (SELECT 1 FROM supporter_links l WHERE l.${column} = s.source_id)`,
).join("\n UNION ALL\n");

const COLUMNS = SUPPORTER_SOURCES.map((s) => s.column).join(", ");
const CANDIDATE_COLUMNS = SUPPORTER_SOURCES.map((s) => `c.${s.column}`).join(", ");

/**
 * Links every unlinked source record to a supporter: to the supporter an
 * existing link matched on the same email, or else to a new one, made for
 * each new email, and each WhatsApp entry by its number (linkByNumber());
 * then merges those who share a UK mobile number, or a WhatsApp one, by the
 * numbers of the supporters it linked, or with `everyone`, by everyone's,
 * which catches a number given since a record was linked, as the Luma
 * and members imports do; then brings what's worked out about each supporter it linked
 * or merged into up to date. Set-based, in one transaction (`db`'s, or its
 * own).
 */
export async function linkSupporters(db?: Queryable, everyone = false): Promise<LinkResult> {
  if (!db) return transaction((own) => linkSupporters(own, everyone));
  await query(`CREATE TEMP TABLE candidates ON COMMIT DROP AS ${CANDIDATES}`, [], db);
  // The email already belongs to a supporter.
  const existing = await query<{ id: number }>(
    `INSERT INTO supporter_links (supporter_id, ${COLUMNS}, matched_by, matched_value)
     SELECT DISTINCT ON (${CANDIDATE_COLUMNS}) l.supporter_id, ${CANDIDATE_COLUMNS}, 'email', c.email
     FROM candidates c JOIN supporter_links l ON l.matched_by = 'email' AND l.matched_value = c.email
     RETURNING supporter_id::int AS id`,
    [],
    db,
  );
  // A new supporter for each email nobody has, and a link for every candidate with it.
  await query(
    `CREATE TEMP TABLE new_supporters ON COMMIT DROP AS
     SELECT email, nextval(pg_get_serial_sequence('supporters', 'id')) AS id
     FROM (SELECT DISTINCT c.email FROM candidates c
           WHERE NOT EXISTS (SELECT 1 FROM supporter_links l WHERE l.matched_by = 'email' AND l.matched_value = c.email)) e`,
    [],
    db,
  );
  const added = await query<{ id: number }>(
    "INSERT INTO supporters (id) OVERRIDING SYSTEM VALUE SELECT id FROM new_supporters RETURNING id::int AS id",
    [],
    db,
  );
  const fresh = await query<{ id: number }>(
    `INSERT INTO supporter_links (supporter_id, ${COLUMNS}, matched_by, matched_value)
     SELECT n.id, ${CANDIDATE_COLUMNS}, 'email', c.email FROM candidates c JOIN new_supporters n USING (email)
     RETURNING supporter_id::int AS id`,
    [],
    db,
  );
  await query("DROP TABLE candidates, new_supporters", [], db);
  const byNumber = await linkByNumber(db);
  const linked = [...new Set([...existing, ...fresh, ...byNumber.linked].map((link) => link.id))];
  const merged = await query<{ id: number }>(
    "SELECT DISTINCT id::int AS id FROM merge_supporters_by_phone($1::bigint[]) id",
    [everyone ? null : linked],
    db,
  );
  const linkedTo = [...new Set([...linked, ...merged.map((row) => row.id)])];
  if (linkedTo.length > 0) await refreshSupporterFacts(db, linkedTo);
  const newIds = [...added, ...byNumber.added].map((row) => row.id);
  const links = existing.length + fresh.length + byNumber.linked.length;
  if (merged.length === 0) return { supportersAdded: newIds.length, linked: links };
  // Those merged went, so the list loses them now, and only the new supporters still here were added.
  await refreshSupportersList(db);
  const [{ kept }] = await query<{ kept: number }>(
    "SELECT count(*)::int AS kept FROM supporters WHERE id = ANY($1::bigint[])",
    [newIds],
    db,
  );
  return { supportersAdded: kept, linked: links };
}

/**
 * Links each unlinked WhatsApp entry, which has a number and no email: to a
 * supporter who gave the number anywhere, the oldest if several did, or else
 * to a new one, made for each number nobody has. Says the supporters it
 * linked to, and those it made.
 */
async function linkByNumber(db: Queryable): Promise<{ linked: { id: number }[]; added: { id: number }[] }> {
  await query(
    `CREATE TEMP TABLE by_number ON COMMIT DROP AS
     SELECT f.id AS form_entry_id, f.phone AS number FROM form_entries f
     WHERE f.form = 'whatsapp-community' AND NOT EXISTS (SELECT 1 FROM supporter_links l WHERE l.form_entry_id = f.id)`,
    [],
    db,
  );
  // Mostly none, so the matching below, over every number, is left out.
  const [{ unlinked }] = await query<{ unlinked: number }>("SELECT count(*)::int AS unlinked FROM by_number", [], db);
  if (unlinked === 0) {
    await query("DROP TABLE by_number", [], db);
    return { linked: [], added: [] };
  }
  // The number already belongs to a supporter.
  const existing = await query<{ id: number; entry: number }>(
    `INSERT INTO supporter_links (supporter_id, form_entry_id, matched_by, matched_value)
     SELECT DISTINCT ON (b.form_entry_id) c.supporter_id, b.form_entry_id, 'phone', b.number
     FROM by_number b JOIN supporter_contact c ON c.phone = b.number
     ORDER BY b.form_entry_id, c.supporter_id
     RETURNING supporter_id::int AS id, form_entry_id::int AS entry`,
    [],
    db,
  );
  await query("DELETE FROM by_number WHERE form_entry_id = ANY($1::bigint[])", [existing.map((l) => l.entry)], db);
  // A new supporter for each number nobody has, and a link for every entry with it.
  await query(
    `CREATE TEMP TABLE new_by_number ON COMMIT DROP AS
     SELECT number, nextval(pg_get_serial_sequence('supporters', 'id')) AS id FROM (SELECT DISTINCT number FROM by_number) n`,
    [],
    db,
  );
  const added = await query<{ id: number }>(
    "INSERT INTO supporters (id) OVERRIDING SYSTEM VALUE SELECT id FROM new_by_number RETURNING id::int AS id",
    [],
    db,
  );
  const fresh = await query<{ id: number }>(
    `INSERT INTO supporter_links (supporter_id, form_entry_id, matched_by, matched_value)
     SELECT n.id, b.form_entry_id, 'phone', b.number FROM by_number b JOIN new_by_number n USING (number)
     RETURNING supporter_id::int AS id`,
    [],
    db,
  );
  await query("DROP TABLE by_number, new_by_number", [], db);
  return { linked: [...existing, ...fresh], added };
}

/**
 * Whether supporter `s` is a contact of the Luma calendar's now: they follow
 * it, and haven't opted out of its emails. The opt-out is looked up as the
 * list is read, not kept with it, so Luma's webhook saying so shows at once.
 */
const LUMA_CONTACT = `(s.luma_follows AND NOT ${optedOutOfLuma("s.emails")})`;

/**
 * A supporter's summary as staff see it, from `s`, a row shaped as
 * supporters_listed's: who they are, their addresses and numbers, what
 * they've done, and where they are (a place's name, what it's from and
 * where it is), or nulls.
 */
/** How many broadcasts supporter `s` was sent a copy of, whether it went or not, as their page lists them. */
const BROADCASTS = "(SELECT count(*)::int FROM broadcast_messages c WHERE c.supporter_id = s.id)";

/** How many notes staff have written on supporter `s`. */
const NOTES = "(SELECT count(*)::int FROM notes n WHERE n.supporter_id = s.id)";

const SUMMARY_COLUMNS = `s.id::int AS id, s.name, coalesce(s.emails, '{}') AS emails, s.phones, s.postcode,
  coalesce(s.sources, '{}') AS sources, ${LUMA_CONTACT} AS "lumaContact", s.first_seen_at AS "firstSeenAt",
  s.last_active_at AS "lastActiveAt", s.events, s.letters, ${BROADCASTS} AS broadcasts, ${NOTES} AS notes, s.member,
  CASE WHEN s.basis IS NULL THEN NULL
  ELSE json_build_object('name', s.place, 'basis', s.basis, 'given', s.given, 'country', s.country,
    'latitude', s.latitude, 'longitude', s.longitude) END AS place`;

/**
 * Supporter $1's row, shaped as supporters_listed's, worked out now from
 * the views rather than read from the list's last refresh: for their page.
 */
const LIVE_SUMMARY = `(SELECT s.*,
    sp.place, sp.basis, sp.given, sp.country, sp.latitude, sp.longitude
  FROM supporters_summary s LEFT JOIN supporter_place sp ON sp.supporter_id = s.id WHERE s.id = $1) s`;

/** When a supporter has each lozenge in the Activities column, as SupporterBadges shows them. */
const BADGE_CONDITIONS: Record<SupporterBadge, string> = {
  member: "s.member",
  lumaContact: LUMA_CONTACT,
  registered: "s.events > 0",
  letter: "s.letters > 0",
  march: `s.sources && ARRAY[${MARCH_SOURCES.map((source) => `'${source}'`).join(", ")}]`,
  paper: "'paper-signup' = ANY(s.sources)",
  whatsapp: "'whatsapp-community' = ANY(s.sources)",
};

export type SupportersPage = {
  supporters: SupporterRow[];
  total: number;
  pages: number;
  /** Where the Near filter's words are, if it's on: a place, none found, or "failed" if postcodes.io couldn't say. */
  near?: FoundPlace | null | "failed";
};

/** Miles between a supporter's place and the point `lat`, `lon` (the haversine formula, on a round Earth). */
const milesFrom = (lat: number, lon: number) =>
  sql`3958.8 * 2 * asin(sqrt(power(sin(radians(s.latitude - ${lat}) / 2), 2)
     + cos(radians(${lat})) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - ${lon}) / 2), 2)))`;

/**
 * The conditions of the filters that repeat, those that are on: each finds
 * those with any of its values. An event is one they registered for, but
 * for declined. A contact one is an answer for any of their addresses, or
 * any of their numbers, for its consent: any answer, or one, or one reason.
 */
function anyOf(filter: Pick<SupporterFilter, NegatableSupporterFilter>): Sql[] {
  const conditions: Sql[] = [];
  if (filter.activity) conditions.push(sql.or(filter.activity.map((badge) => sql.raw(BADGE_CONDITIONS[badge]))));
  if (filter.contact) {
    const states = (channel: Channel) =>
      filter
        .contact!.filter((state) => channelOf(state.way) === channel)
        .map(({ topic, way, send, reason }) =>
          sql.and([
            sql`p.topic = ${topic}`,
            ...(channel === "phone" ? [sql`p.way = ${way}`] : []),
            ...(send ? [sql`p.send = ${send}`] : []),
            ...(reason ? [sql`p.reason = ${reason}`] : []),
          ]),
        );
    const [emails, phones] = [states("email"), states("phone")];
    // Each finds its supporters once, as a list (ARRAY()), rather than IN, for which Postgres may walk the
    // supporters in the page's order checking each against them: slow when few are found.
    const found = [
      ...(emails.length
        ? [
            sql`s.id = ANY(ARRAY(SELECT i.supporter_id FROM supporter_identity i
               JOIN email_permissions p ON p.address = i.email WHERE ${sql.or(emails)}))`,
          ]
        : []),
      ...(phones.length
        ? [
            sql`s.id = ANY(ARRAY(SELECT c.supporter_id FROM supporter_contact c
               JOIN phone_permissions p ON p.address = c.phone WHERE ${sql.or(phones)}))`,
          ]
        : []),
    ];
    conditions.push(sql.or(found));
  }
  if (filter.event) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM luma_guests g JOIN supporter_links k ON k.luma_user_id = g.user_id
       WHERE k.supporter_id = s.id AND g.event_id = ANY(${filter.event}) AND g.approval_status <> 'declined')`,
    );
  }
  if (filter.country) conditions.push(sql`s.country = ANY(${filter.country})`);
  // Any MP is one of the MP filter's values, so it finds those with any MP, whichever others are chosen.
  if (filter.mp || filter.hasMp) {
    conditions.push(
      sql`s.basis = 'postcode' AND upper(replace(s.given, ' ', '')) IN (SELECT pp.postcode FROM postcode_places pp
         JOIN (${sql.raw(MP_CHOICES)}) p ON p.constituency = pp.constituency
         ${filter.hasMp ? sql`` : sql`WHERE p.id = ANY(${filter.mp})`})`,
    );
  }
  return conditions;
}

/**
 * Every supporter's email addresses and numbers, as a WITH clause's two
 * tables: `i` (supporter_id, email) and `c` (supporter_id, phone). Each is a
 * view of views, with no index on its address, so joined straight to a list
 * of addresses Postgres reads the whole view again for each one: seconds,
 * for the unsubscribes. MATERIALIZED reads each once a query.
 */
export const SUPPORTER_ADDRESSES = `i AS MATERIALIZED (SELECT supporter_id, email FROM supporter_identity),
  c AS MATERIALIZED (SELECT supporter_id, phone FROM supporter_contact)`;

/** Those seen at `column` in the last `days` days, up to now. */
const within = (column: string, days: number) =>
  sql`${sql.raw(column)} >= ${windowStart(days)} AND ${sql.raw(column)} <= ${now()}`;

/** Their addresses and numbers: a row of supporters_listed. */
type Reachable = { emails: string[]; phones: string[] };

/**
 * What each of `rows` said about being contacted, in one query for them all:
 * a function from one of them to its answers.
 */
async function permissionsOfRows(rows: Reachable[]): Promise<(row: Reachable) => ContactPermission[]> {
  const permissions = await permissionsFor(
    rows.flatMap((row) => row.emails),
    rows.flatMap((row) => row.phones),
  );
  // Each address's answers, looked up rather than searched for: a broadcast's rows are thousands. Every address
  // has its place, as permissionsFor() writes it, so each answer, which is for one of them, has its own.
  const keys = (row: Reachable) => [
    ...new Set([
      ...row.emails.map((address) => `email ${address.trim().toLowerCase()}`),
      ...row.phones.map((number) => `phone ${number}`),
    ]),
  ];
  const byAddress = new Map(rows.flatMap(keys).map((key) => [key, [] as ContactPermission[]]));
  for (const p of permissions) byAddress.get(`${p.channel} ${p.address}`)!.push(p);
  return (row) => keys(row).flatMap((key) => byAddress.get(key)!);
}

/**
 * Everyone each of `filters` finds, with what they said about being
 * contacted: a list for each filter, in their order. A query for each filter,
 * all at once, then one for everyone's answers: two rounds of the database,
 * however many filters. Not one query of them all, as Postgres would run its
 * parts one after another.
 */
export async function supportersFoundBy(filters: SupporterFilter[]): Promise<ContactPermission[][][]> {
  const found = await Promise.all(
    filters.map(async (filter) => {
      const { where } = await supporterConditions(filter);
      return query<Reachable>(
        sql`SELECT coalesce(s.emails, '{}') AS emails, s.phones FROM supporters_listed s ${sql.where(where)}`,
      );
    }),
  );
  const theirs = await permissionsOfRows(found.flat());
  return found.map((rows) => rows.map(theirs));
}

/**
 * What a supporter in supporters_listed (as `s`) must be to match `filter`,
 * and the place its Near filter's words found: null for none, "failed", or
 * undefined with no Near filter. The words are looked up at postcodes.io; a
 * place it can't find finds no one.
 */
async function supporterConditions(
  filter: SupporterFilter,
): Promise<{ where: Sql[]; near: Awaited<ReturnType<typeof placeFor>> | undefined }> {
  const where: Sql[] = [];
  if (filter.search) {
    // A word is also found in the tag of their proxy, the address their letters go from: jane.smith.
    const words = everyWord(
      filter.search,
      (like) =>
        sql`${contains("s.name", like)} OR EXISTS (SELECT 1 FROM unnest(s.phones) n WHERE n ILIKE ${like})
         OR EXISTS (SELECT 1 FROM unnest(s.emails) e WHERE e ILIKE ${like})
         OR EXISTS (SELECT 1 FROM unnest(s.emails) e JOIN proxies x ON x.supporter_email = lower(e) WHERE x.tag ILIKE ${like})`,
    );
    const ways = [words];
    // A number typed as people write them, 07700 900001, is found among the numbers as they're stored, +447700900001.
    const phone = phoneSearch(filter.search);
    if (phone) ways.push(sql`EXISTS (SELECT 1 FROM unnest(s.phones) n WHERE n LIKE ${`%${phone}%`})`);
    // Their whole proxy, letters+jane.smith@example.org, finds them by its tag.
    const tag = proxyTag(filter.search);
    if (tag) {
      ways.push(
        sql`EXISTS (SELECT 1 FROM unnest(s.emails) e JOIN proxies x ON x.supporter_email = lower(e) WHERE x.tag = ${tag})`,
      );
    }
    where.push(ways.length > 1 ? sql.or(ways) : words);
  }
  where.push(...anyOf(filter));
  // What's left out: a filter's condition not true, so one with no value, such as no nation, is kept.
  if (filter.not) where.push(...anyOf(filter.not).map((condition) => sql`(${condition}) IS NOT TRUE`));
  if (filter.campaign) {
    where.push(
      sql`${sql.raw(filter.wrote ? "" : "NOT ")}EXISTS (SELECT 1 FROM supporter_links k JOIN letters_from_supporters l ON l.entry_id = k.form_entry_id
       WHERE k.supporter_id = s.id AND l.campaign = ${filter.campaign})`,
    );
  }
  if (filter.firstDays) where.push(within("s.first_seen_at", filter.firstDays));
  if (filter.registeredDays) {
    where.push(
      sql`s.id IN (SELECT k.supporter_id FROM luma_guests g JOIN supporter_links k ON k.luma_user_id = g.user_id
       WHERE g.approval_status = 'approved' AND g.removed_at IS NULL AND ${within("g.registered_at", filter.registeredDays)})`,
    );
  }
  if (filter.unsubscribedDays) {
    // From the consents the Consent filter names, or any.
    const consents = (filter.contact ?? []).map(({ topic, way }) => sql`(u.topic = ${topic} AND u.way = ${way})`);
    const which = consents.length ? sql.or(consents) : sql`true`;
    where.push(
      sql`s.id IN (WITH ${sql.raw(SUPPORTER_ADDRESSES)}
         SELECT i.supporter_id FROM contact_unsubscribes u JOIN i ON i.email = u.address
         WHERE u.way = 'email' AND ${which} AND ${within("u.at", filter.unsubscribedDays)}
       UNION SELECT c.supporter_id FROM contact_unsubscribes u JOIN c ON c.phone = u.address
         WHERE u.way <> 'email' AND ${which} AND ${within("u.at", filter.unsubscribedDays)})`,
    );
  }
  // What the Near filter's words are: a place, null for none, "failed"; or undefined with no Near filter.
  const near = filter.near ? await placeFor(filter.near.text) : undefined;
  if (near === null || near === "failed") where.push(sql`false`);
  else if (near) where.push(sql`${milesFrom(near.latitude, near.longitude)} <= ${filter.near!.miles}`);
  return { where, near };
}

/**
 * One page of the list, filtered and sorted; with a `limit` of null, every
 * one, for a download. Read from supporters_listed: as of the list's last
 * refresh, with anyone added since. The Near filter's words are looked up
 * at postcodes.io; a place it can't find finds no one. The page and how
 * many there are in all are two queries, at once: counting alongside the
 * page would read every row to sort them.
 */
export async function listSupporters(
  filter: SupporterFilter,
  limit: number | null = SUPPORTERS_PAGE_SIZE,
): Promise<SupportersPage> {
  const { where, near } = await supporterConditions(filter);
  const column = {
    active: "s.last_active_at",
    first: "s.first_seen_at",
    name: "s.name COLLATE english",
    events: "s.events",
    letters: "s.letters",
    broadcasts: BROADCASTS,
    notes: NOTES,
  }[filter.sort];
  const dir = filter.dir === "asc" ? "ASC" : "DESC";
  const order = sql.raw(`${column} ${dir} NULLS LAST, s.last_active_at DESC NULLS LAST, s.id ${dir}`);
  const filtered = sql`FROM supporters_listed s ${sql.where(where)}`;
  // The page's rows first, then their columns: worked out before the sort, the columns were for everyone.
  const page = sql`SELECT ${sql.raw(SUMMARY_COLUMNS)} FROM (SELECT s.* ${filtered}
     ORDER BY ${order} LIMIT ${limit} OFFSET ${(filter.page - 1) * (limit ?? 0)}) s ORDER BY ${order}`;
  // With no limit, every row is read, so they're the count.
  const [rows, counted] = await Promise.all([
    query<SupporterSummary>(page),
    limit === null ? undefined : query<{ total: number }>(sql`SELECT count(*)::int AS total ${filtered}`),
  ]);
  const total = counted ? counted[0].total : rows.length;
  const theirs = await permissionsOfRows(rows);
  const ids = rows.map((row) => row.id);
  // For the columns the Event, Campaign and MP filters add: the page's registrations for the events chosen, when
  // each first wrote in the campaign, and each one's MP.
  const [registrations, letters, mps] = await Promise.all([
    filter.event
      ? query<{ id: number; event: string; status: string }>(
          `SELECT k.supporter_id::int AS id, e.name AS event, g.approval_status AS status
           FROM luma_guests g JOIN supporter_links k ON k.luma_user_id = g.user_id JOIN luma_events e ON e.id = g.event_id
           WHERE k.supporter_id = ANY($1) AND g.event_id = ANY($2) ORDER BY e.start_at, e.id`,
          [ids, filter.event],
        )
      : [],
    filter.campaign && filter.wrote
      ? query<{ id: number; at: Date }>(
          `SELECT k.supporter_id::int AS id, min(f.created_at) AS at
           FROM supporter_links k JOIN letters_from_supporters l ON l.entry_id = k.form_entry_id
           JOIN form_entries f ON f.id = l.entry_id
           WHERE k.supporter_id = ANY($1) AND l.campaign = $2 GROUP BY k.supporter_id`,
          [ids, filter.campaign],
        )
      : [],
    filter.mp || filter.hasMp
      ? query<{ id: number; name: string; constituency: string }>(
          `SELECT p.supporter_id::int AS id, m.name, m.constituency FROM supporter_place p
           JOIN postcode_places pp ON pp.postcode = upper(replace(p.given, ' ', ''))
           JOIN (${MP_CHOICES}) m ON m.constituency = pp.constituency
           WHERE p.basis = 'postcode' AND p.supporter_id = ANY($1)`,
          [ids],
        )
      : [],
  ]);
  return {
    supporters: rows.map((row) => ({
      ...row,
      permissions: theirs(row),
      ...(filter.event && {
        registrations: registrations.filter((r) => r.id === row.id).map(({ event, status }) => ({ event, status })),
      }),
      // The filter found only those who wrote in it, so every row has a letter.
      ...(filter.campaign && filter.wrote && { wroteAt: letters.find((l) => l.id === row.id)!.at }),
      // The filter found only those with an MP, so every row has one.
      ...((filter.mp || filter.hasMp) && { mp: mpOf(mps.find((m) => m.id === row.id)!) }),
    })),
    total,
    pages: Math.max(1, Math.ceil(total / SUPPORTERS_PAGE_SIZE)),
    ...(near !== undefined && { near }),
  };
}

/** A supporter's MP as the list's MP column says it: their name and constituency. */
const mpOf = (found: { name: string; constituency: string }) => ({
  name: found.name,
  constituency: found.constituency,
});

/** A Luma event to filter supporters by: its ID, name and when it starts. */
export type EventChoice = { id: string; name: string; startAt: Date };

/** An MP to filter supporters by: their politician ID, name and constituency. */
export type MpChoice = { id: number; name: string; constituency: string };

/** What the Event and MP filters offer. */
export type SupporterChoices = { events: EventChoice[]; mps: MpChoice[] };

/**
 * The Event filter's choices, newest first: our Luma events that we
 * manage, whose guests we know; and the MP filter's, by name.
 */
export const supporterChoices = cache(async function supporterChoices(): Promise<SupporterChoices> {
  const [events, mps] = await Promise.all([
    query<EventChoice>(
      `SELECT id, name, start_at AS "startAt" FROM luma_events
       WHERE access = 'manage' AND removed_at IS NULL ORDER BY start_at DESC, id`,
    ),
    query<MpChoice>(`SELECT * FROM (${MP_CHOICES}) p ORDER BY p.name COLLATE english, p.constituency`),
  ]);
  return { events, mps };
});

/**
 * Everything the staff page shows about one supporter, or undefined if
 * there's no such one. An ID merged into another supporter finds them.
 */
export const getSupporter = cache(async function getSupporter(given: number): Promise<SupporterDetails | undefined> {
  const [{ id }] = await query<{ id: number }>(
    "SELECT coalesce((SELECT into_id FROM supporter_merges WHERE from_id = $1), $1)::int AS id",
    [given],
  );
  const [summary] = await query<SupporterSummary>(`SELECT ${SUMMARY_COLUMNS} FROM ${LIVE_SUMMARY}`, [id]);
  if (!summary) return undefined;
  const postcode = summary.place?.basis === "postcode" ? summary.place.given : null;
  const [identities, contacts, groupTowns, activity, permissions, luma, [mp], letters] = await Promise.all([
    query<SupporterIdentity>(
      `SELECT source, email, name, seen_at AS "seenAt" FROM supporter_identity WHERE supporter_id = $1 ORDER BY seen_at NULLS LAST, email`,
      [id],
    ),
    query<SupporterContact>(
      `SELECT source, at, phone, postcode, latitude, longitude, city FROM supporter_contact
       WHERE supporter_id = $1 AND (phone IS NOT NULL OR postcode IS NOT NULL OR latitude IS NOT NULL OR city IS NOT NULL)
       ORDER BY at DESC`,
      [id],
    ),
    query<SupporterGroupTown>(
      `SELECT DISTINCT u.town, u.note AS "group", u.uploaded_at AS at FROM supporter_links k
         JOIN signup_upload_entries e ON e.entry_id = k.form_entry_id JOIN signup_uploads u ON u.id = e.upload_id
       WHERE k.supporter_id = $1 AND u.kind = 'whatsapp' AND u.town IS NOT NULL
       ORDER BY at`,
      [id],
    ),
    query<SupporterActivity>(
      `SELECT a.source, a.at, a.kind, a.title, c.title AS "campaignTitle", a.detail, a.href, a.status,
         e.start_at AS "eventAt", o.how, o.recorded_by AS "recordedBy", o.thread,
         -- The letter it's about: this campaign's to this MP, nearest in time, as a person may write twice.
         CASE WHEN a.kind IN ('letter', 'letter-replied') THEN (
           SELECT l.id::int FROM letters_from_supporters s JOIN letters l USING (id)
             JOIN supporter_links k ON k.form_entry_id = s.entry_id
           WHERE k.supporter_id = a.supporter_id AND s.campaign = a.title AND '/staff/politicians/' || l.notable_person_id = a.href
           ORDER BY abs(extract(epoch FROM l.created_at - a.at)) LIMIT 1
         ) END AS "letterId"
       FROM supporter_activity a LEFT JOIN campaigns c ON a.kind IN ('letter', 'letter-replied') AND c.slug = a.title
         LEFT JOIN luma_events e ON a.kind IN ('luma-registered', 'luma-hosted') AND a.href = 'https://luma.com/' || e.url
         LEFT JOIN LATERAL (${OPT_OUT_RECORDED}) o ON true
       WHERE a.supporter_id = $1 ORDER BY a.at DESC, a.kind`,
      [id],
    ),
    permissionsFor(summary.emails, summary.phones),
    lumaCalendarAnswers(summary.emails),
    // Their MP, in office for their postcode's constituency.
    postcode
      ? query<SupporterMp>(
          `SELECT m.id, m.name, m.constituency, p.party FROM postcode_places pp
           JOIN (${MP_CHOICES}) m ON m.constituency = pp.constituency JOIN politicians p ON p.id = m.id
           WHERE pp.postcode = upper(replace($1, ' ', '')) LIMIT 1`,
          [postcode],
        )
      : [],
    query<SupporterLetter>(
      `SELECT l.id::int AS id, l.sent_at AS "sentAt", n.name AS "mpName", n.id::int AS "politicianId",
         coalesce((SELECT p.is_test FROM politicians p WHERE p.id = n.id), false) AS "isTest", s.campaign,
         c.title AS "campaignTitle", l.status, ${REPLIES} AS replies
       FROM supporter_links k JOIN letters_from_supporters s ON s.entry_id = k.form_entry_id
         JOIN campaigns c ON c.slug = s.campaign
         JOIN letters l ON l.id = s.id JOIN notable_people n ON n.id = l.notable_person_id
       WHERE k.supporter_id = $1 ORDER BY l.created_at DESC, l.id DESC`,
      [id],
    ),
  ]);
  return { summary, letters, mp: mp ?? null, identities, contacts, groupTowns, activity, permissions, luma };
});
