import "server-only";
import constituencies from "@/lib/constituencies.json";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { importPath, type PoliticianImportJob, type PoliticianImportResult } from "@/lib/import-runs";
import { ownDomains } from "@/lib/politician-domains";
import {
  added,
  BODY_HOUSES,
  compareMembers,
  holdsImport,
  importChangeCount,
  matchMembers,
  sharedAddresses,
  updated,
  type Body,
  type Ending,
  type ImportChanges,
  type OfficialMember,
  type OurPolitician,
} from "@/lib/politician-import";
import { isSharedInbox } from "@/lib/one-off";
import { personalSalutation, surnameOf } from "@/lib/salutation";
import { TEST_MPS } from "@/lib/test-mps";
import type { WikidataPerson } from "@/lib/wikidata";
import { logChange } from "./audit";
import { config } from "./config";
import { query, transaction, type Queryable } from "./db";
import { asRun } from "./import-runs";
import { notifyStaff, staffLink } from "./notifications";
import { relinkOneOffs } from "./one-off-relink";
import {
  niAssemblyMembersNow,
  scottishParliamentMembersNow,
  seneddMembersNow,
} from "./outside-services/devolved-bodies";
import { parliamentEndings, parliamentMembersNow } from "./outside-services/parliament";
import { mspPeople, seneddPeople } from "./outside-services/wikidata";
import { addPolitician } from "./politicians";
import { problem } from "./problems";

// Imports each body's members from its own list, nightly
// (/api/cron/import-<body>) or when staff ask: Parliament's, both Houses;
// the Scottish Parliament's; the Senedd's; the Northern Ireland Assembly's.
// Each politician is matched by the ID their body gives them, or the first
// time, by name (lib/politician-import.ts). An import adds new members,
// updates names, parties, seats and emails, marks those who've left, and
// keeps each address their body lists and each domain of their own, which
// say whose a one-off thread is, then relinks the threads. One that would
// change too much, or anyone's name, is held for a person to apply or
// discard. Every run goes in the import log, under its job.

/** Each body's job in the import log. */
export const BODY_JOBS: Record<Body, PoliticianImportJob> = {
  parliament: "import-parliament",
  "scottish-parliament": "import-scottish-parliament",
  senedd: "import-senedd",
  "ni-assembly": "import-ni-assembly",
};

const BODY_OF = Object.fromEntries(Object.entries(BODY_JOBS).map(([body, job]) => [job, body])) as Record<
  PoliticianImportJob,
  Body
>;

/** How long relinking reads quotes not yet stored, leaving the run time to finish inside a Netlify function's 30 seconds. */
const READ_QUOTES_MS = 8_000;

/** Each body's sitting members, as its list gives them. */
const FETCH: Record<Body, () => Promise<OfficialMember[]>> = {
  parliament: parliamentMembersNow,
  "scottish-parliament": () => scottishParliamentMembersNow(new Date()),
  senedd: seneddMembersNow,
  "ni-assembly": niAssemblyMembersNow,
};

/** Genders and surnames from Wikidata, for the bodies that give neither titles nor genders. */
const PEOPLE: Partial<Record<Body, (ids: number[]) => Promise<Map<number, WikidataPerson>>>> = {
  "scottish-parliament": mspPeople,
  senedd: seneddPeople,
};

/** A body's politicians as an import compares them, test politicians aside. */
async function bodyPoliticians(body: Body, db?: Queryable): Promise<OurPolitician[]> {
  return query<OurPolitician>(
    `SELECT n.id::int AS id, p.official_id AS "officialId", p.house, n.name, n.salutation,
       n.salutation_to_check AS "salutationToCheck", p.constituency, p.party, p.country, n.email, n.status,
       coalesce(array_agg(a.address ORDER BY a.address) FILTER (WHERE a.address IS NOT NULL), '{}') AS listed
     FROM notable_people n JOIN politicians p ON p.id = n.id
       LEFT JOIN politician_addresses a ON a.notable_person_id = n.id AND a.source = 'parliament'
     WHERE NOT p.is_test AND p.house = ANY($1::text[])
     GROUP BY n.id, p.id ORDER BY n.id`,
    [BODY_HOUSES[body]],
    db,
  );
}

/** The members with no address two of them list, or that's a shared inbox: neither is anyone's own. */
function withoutShared(members: OfficialMember[]): OfficialMember[] {
  const shared = sharedAddresses(members);
  return members.map((m) => ({ ...m, emails: m.emails.filter((e) => !shared.has(e) && !isSharedInbox(e)) }));
}

/**
 * The members, each with a salutation by rule where their body gives no
 * title: from their gender in Wikidata, looked up only for those who need
 * one, new members and those whose salutation is waiting to be checked. If
 * Wikidata can't be asked, they go without, and are asked about next time.
 */
async function withSalutations(
  body: Body,
  members: OfficialMember[],
  ours: OurPolitician[],
): Promise<OfficialMember[]> {
  const lookUp = PEOPLE[body];
  if (!lookUp) return members;
  const pairs = matchMembers(ours, members);
  const need = members.filter((m) => !pairs.has(m) || pairs.get(m)!.salutationToCheck).map((m) => m.officialId);
  if (need.length === 0) return members;
  let people: Map<number, WikidataPerson>;
  try {
    people = await lookUp(need);
  } catch (error) {
    problem(staffCopy.politicianImports.genderLookupFailed, error);
    return members;
  }
  return members.map((m) => {
    const person = people.get(m.officialId);
    if (!person) return m;
    const first = m.name.split(/\s+/)[0];
    const surname = m.surname ?? person.surname ?? surnameOf(m.name);
    return { ...m, salutation: personalSalutation({ first, surname }, person.gender) };
  });
}

/**
 * The test MPs, whose letters go to TEST_MP_EMAIL: kept in step with that
 * setting by Parliament's import, except the one who has no email and the
 * one with an address of their own. Their statuses are set only when
 * they're added, so staff can change them.
 */
async function ensureTestMps(db: Queryable): Promise<void> {
  const email = config.testMpEmail ?? null;
  for (const mp of TEST_MPS) {
    const address = mp.noEmail ? null : (mp.email ?? email);
    const [existing] = await query<{ id: number }>(
      `UPDATE notable_people SET email = $2, updated_at = now()
       WHERE id = (SELECT id FROM politicians WHERE test_postcode = $1) RETURNING id::int AS id`,
      [mp.postcode, address],
      db,
    );
    if (existing) continue;
    const id = await addPolitician(
      { house: "commons", name: mp.name, salutation: mp.salutation, constituency: mp.constituency, email: address },
      db,
      mp.postcode,
    );
    for (const [ask, status] of Object.entries(mp.statuses)) {
      await query(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
         SELECT $1, slug, kind, $3, 'sync' FROM asks WHERE slug = $2`,
        [id, ask, status],
        db,
      );
    }
  }
}

/** Writes a politician's imported fields over their two rows. */
async function writeFields(id: number, fields: ReturnType<typeof added>, db: Queryable): Promise<void> {
  await query(
    `UPDATE notable_people SET name = $2, salutation = $3, salutation_to_check = $4, email = $5, status = $6,
       updated_at = now() WHERE id = $1`,
    [id, fields.name, fields.salutation, fields.salutationToCheck, fields.email, fields.status],
    db,
  );
  await query(
    "UPDATE politicians SET official_id = $2, house = $3, constituency = $4, party = $5, country = $6 WHERE id = $1",
    [id, fields.officialId, fields.house, fields.constituency, fields.party, fields.country],
    db,
  );
}

/**
 * Keeps each address the list gives its members, by whose: one listed for
 * someone else now is theirs alone, and one no longer listed stays, as a past
 * one. Then each body's own domains, from their email and web addresses: one
 * of theirs no longer listed goes.
 */
async function saveListed(body: Body, people: { id: number; member: OfficialMember }[], db: Queryable): Promise<void> {
  const listed = people.flatMap(({ id, member }) => member.emails.map((address) => ({ id, address })));
  await query(
    `DELETE FROM politician_addresses a USING unnest($1::text[], $2::bigint[]) AS l (address, id)
     WHERE a.source = 'parliament' AND a.address = l.address AND a.notable_person_id <> l.id`,
    [listed.map((l) => l.address), listed.map((l) => l.id)],
    db,
  );
  await query(
    `INSERT INTO politician_addresses (address, notable_person_id, source)
     SELECT address, id, 'parliament' FROM unnest($1::text[], $2::bigint[]) AS l (address, id) ON CONFLICT DO NOTHING`,
    [listed.map((l) => l.address), listed.map((l) => l.id)],
    db,
  );
  const domains = ownDomains(
    people.map(({ id, member }) => ({ id, addresses: [...member.emails, ...member.websites] })),
  );
  await query(
    `DELETE FROM politician_domains WHERE NOT (domain = ANY($1::text[]))
       AND notable_person_id IN (SELECT id FROM politicians WHERE house = ANY($2::text[]))`,
    [[...domains.keys()], BODY_HOUSES[body]],
    db,
  );
  await query(
    `INSERT INTO politician_domains (domain, notable_person_id) SELECT * FROM unnest($1::text[], $2::bigint[])
     ON CONFLICT (domain) DO UPDATE SET notable_person_id = EXCLUDED.notable_person_id, seen_at = now()`,
    [[...domains.keys()], [...domains.values()]],
    db,
  );
}

/**
 * Makes a body's politicians match its list: adds the new members, updates
 * the rest and marks those who've left, each in the audit log, by their
 * row's id, so their page can tell it; then keeps their addresses.
 */
async function applyMembers(
  job: PoliticianImportJob,
  members: OfficialMember[],
  endings: ReadonlyMap<number, Ending>,
  db: Queryable,
): Promise<ImportChanges> {
  const body = BODY_OF[job];
  const { pairs, ...changes } = compareMembers(await bodyPoliticians(body, db), members, endings);
  const changed = new Map(changes.changed.map((c) => [c.id, c]));
  const people: { id: number; member: OfficialMember }[] = [];
  for (const [member, ourOne] of pairs) {
    people.push({ id: ourOne.id, member });
    const change = changed.get(ourOne.id);
    if (!change) continue;
    await writeFields(ourOne.id, updated(ourOne, member), db);
    await logChange(job, "edit politician", change, db);
  }
  for (const member of changes.added) {
    const fields = added(member);
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO notable_people (kind, name, salutation, salutation_to_check, email, status)
       VALUES ('politician', $1, $2, $3, $4, 'in_office') RETURNING id::int AS id`,
      [fields.name, fields.salutation, fields.salutationToCheck, fields.email],
      db,
    );
    await query(
      `INSERT INTO politicians (id, house, constituency, party, country, official_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, fields.house, fields.constituency, fields.party, fields.country, fields.officialId],
      db,
    );
    people.push({ id, member });
    await logChange(job, "add politician", { id, ...fields }, db);
  }
  for (const leaver of changes.left) {
    await query(
      "UPDATE notable_people SET status = $2, updated_at = now() WHERE id = $1",
      [leaver.id, leaver.status],
      db,
    );
    await logChange(
      job,
      "edit politician",
      {
        id: leaver.id,
        name: leaver.name,
        changed: { status: ["in_office", leaver.status] },
        date: leaver.date,
        note: leaver.reason ?? "",
      },
      db,
    );
  }
  await saveListed(body, people, db);
  return changes;
}

/**
 * The constituencies with no MP in office, and a problem for any with two:
 * every constituency has one, but for a vacancy before a by-election, or a
 * postcode would find the wrong MP or none.
 */
async function checkSeats(): Promise<string[]> {
  const rows = await query<{ constituency: string; mps: number }>(
    `SELECT p.constituency, count(*)::int AS mps FROM politicians p JOIN notable_people n USING (id)
     WHERE p.house = 'commons' AND n.status = 'in_office' AND NOT p.is_test AND p.constituency IS NOT NULL
     GROUP BY p.constituency`,
  );
  const held = new Map(rows.map((row) => [row.constituency, row.mps]));
  const doubled = rows.filter((row) => row.mps > 1).map((row) => row.constituency);
  if (doubled.length > 0) problem(staffCopy.politicianImports.twoMps, doubled.join(", "));
  return Object.values(constituencies)
    .filter((name) => !held.has(name))
    .sort((a, b) => a.localeCompare(b, "en-GB"));
}

export type PoliticianImportOutcome = { status: "applied" | "held" | "unchanged"; result: PoliticianImportResult };

/**
 * Reads a body's list and applies it, or holds it if it would change too
 * much, keeping the run either way. `startedBy` is NIGHTLY or the staff
 * member's email.
 */
export async function importPoliticians(body: Body, startedBy: string): Promise<PoliticianImportOutcome> {
  const job = BODY_JOBS[body];
  return asRun(job, startedBy, async () => {
    const fetched = withoutShared(await FETCH[body]());
    const before = await bodyPoliticians(body);
    const leaving = compareMembers(before, fetched).left;
    const ids = before.flatMap((p) =>
      leaving.some((l) => l.id === p.id) && p.officialId !== null ? [p.officialId] : [],
    );
    const endings = body === "parliament" && ids.length > 0 ? await parliamentEndings(ids) : new Map<number, Ending>();
    const members = await withSalutations(body, fetched, before);
    let newlyHeld = false;
    const outcome = await transaction(async (db): Promise<PoliticianImportOutcome> => {
      if (body === "parliament") await ensureTestMps(db);
      const ours = await bodyPoliticians(body, db);
      const { added, changed, left, renamed, unofficial, salutations } = compareMembers(ours, members, endings);
      const changes = { added, changed, left, renamed, unofficial, salutations };
      // The very first import of a body fills it from nothing, so there's nothing to check it against.
      const held = ours.length > 0 && holdsImport(changes);
      const count = importChangeCount(changes);
      if (!held) await applyMembers(job, members, endings, db);
      const [heldBefore] = await query("SELECT 1 FROM import_runs WHERE job = $1 AND status = 'held'", [job], db);
      newlyHeld = held && !heldBefore;
      const counts = { job, added: changes.added.length, left: changes.left.length, changed: changes.changed.length };
      if (count > 0) await logChange(job, held ? "hold politician import" : "apply politician import", counts, db);
      return {
        status: held ? "held" : count > 0 ? "applied" : "unchanged",
        result: { changes, ...(held ? { members, endings: [...endings] } : {}) },
      };
    });
    if (newlyHeld) {
      const words = staffCopy.notifications.importHeld;
      const count = importChangeCount(outcome.result.changes);
      const title = jobTitles[job];
      await notifyStaff(words.subject(title, count), words.body(title, count, staffLink(importPath(job), undefined)));
    }
    if (outcome.status !== "held") {
      if (body === "parliament") outcome.result.vacant = await checkSeats();
      outcome.result.relinked = await relinkOneOffs(Date.now() + READ_QUOTES_MS);
    }
    return outcome;
  });
}

/** Whether a job is a body's import. */
export function isPoliticianImport(job: string): job is PoliticianImportJob {
  return Object.hasOwn(BODY_OF, job);
}

/** Applies or discards a held import. False if there's no held import with that ID. */
export async function decideHeldImport(id: number, decision: "apply" | "discard", staff: string): Promise<boolean> {
  const decided = await transaction(async (db) => {
    const [held] = await query<{ job: PoliticianImportJob; members: OfficialMember[]; endings: [number, Ending][] }>(
      `SELECT job, result->'members' AS members, result->'endings' AS endings FROM import_runs
       WHERE id = $1 AND job = ANY($2::text[]) AND status = 'held' FOR UPDATE`,
      [id, Object.values(BODY_JOBS)],
      db,
    );
    if (!held) return false;
    if (decision === "apply") await applyMembers(held.job, held.members, new Map(held.endings), db);
    await query(
      "UPDATE import_runs SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1",
      [id, decision === "apply" ? "applied" : "discarded", staff],
      db,
    );
    await logChange(staff, `${decision} held politician import`, { id, job: held.job }, db);
    return true;
  });
  if (decided && decision === "apply") await relinkOneOffs(Date.now() + READ_QUOTES_MS);
  return decided;
}
