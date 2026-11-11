import "server-only";
import { checkAgainstParliament, ownDomains, type MpProblem } from "@/lib/mp-check";
import { query } from "./db";
import { asRun } from "./import-runs";
import type { Relinked } from "@/lib/import-runs";
import { relinkOneOffs } from "./one-off-relink";
import { mpsInOffice } from "./politician-sync";
import { currentMps } from "./outside-services/parliament";
import type { ParliamentMp } from "@/lib/parliament";

// Compares the MPs copied from Airtable with Parliament's, nightly
// (/api/cron/check-mps) or when staff ask, and keeps what it finds in
// the import log (import-runs.ts, as "check-mps") for /staff/scheduled-jobs. It
// changes nothing in Airtable's copy. It keeps what Parliament lists that says
// whose a thread is (lib/server/one-off-emails.ts): each MP's emails, in
// politician_addresses, and the domains of their own, in politician_domains;
// then relinks the one-off threads (one-off-relink.ts).

const JOB = "check-mps";

/** How long relinking reads quotes not yet stored, leaving the run time to finish inside a Netlify function's 30 seconds. */
const READ_QUOTES_MS = 8_000;

/** Keeps each MP's listed emails and own domains, by their constituency: one no longer listed goes. */
async function saveListed(parliament: ParliamentMp[]): Promise<void> {
  const ours = await query<{ id: number; constituency: string }>(
    `SELECT p.id::int AS id, p.constituency FROM politicians p JOIN notable_people n USING (id)
     WHERE p.house = 'commons' AND n.status = 'in_office'`,
  );
  const ids = new Map(ours.map((mp) => [mp.constituency, mp.id]));
  const people = parliament.flatMap((mp) => {
    const id = ids.get(mp.constituency);
    return id === undefined ? [] : [{ id, emails: mp.emails, addresses: [...mp.emails, ...mp.websites] }];
  });
  const domains = ownDomains(people);
  await query("DELETE FROM politician_domains WHERE NOT (domain = ANY($1::text[]))", [[...domains.keys()]]);
  await query(
    `INSERT INTO politician_domains (domain, notable_person_id) SELECT * FROM unnest($1::text[], $2::bigint[])
     ON CONFLICT (domain) DO UPDATE SET notable_person_id = EXCLUDED.notable_person_id, seen_at = now()`,
    [[...domains.keys()], [...domains.values()]],
  );
  const listed = people.flatMap(({ id, emails }) =>
    [...new Set(emails.map((email) => email.toLowerCase()))]
      .filter((email) => /^[^\s@]+@[^\s@]+$/.test(email))
      .map((email) => ({ id, email })),
  );
  await query(
    `DELETE FROM politician_addresses WHERE source = 'parliament' AND (address, notable_person_id) NOT IN
       (SELECT * FROM unnest($1::text[], $2::bigint[]))`,
    [listed.map((row) => row.email), listed.map((row) => row.id)],
  );
  await query(
    `INSERT INTO politician_addresses (address, notable_person_id, source)
     SELECT address, id, 'parliament' FROM unnest($1::text[], $2::bigint[]) AS l (address, id) ON CONFLICT DO NOTHING`,
    [listed.map((row) => row.email), listed.map((row) => row.id)],
  );
}

/** Checks the MPs in office against Parliament's, keeping the result, or the failure. */
export async function checkMps(startedBy: string): Promise<{ problems: MpProblem[]; relinked: Relinked }> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const parliament = await currentMps();
    const problems = checkAgainstParliament(await mpsInOffice(), parliament);
    await saveListed(parliament);
    const relinked = await relinkOneOffs(Date.now() + READ_QUOTES_MS);
    return { status: "ok", result: { problems, relinked } } as const;
  });
  return result;
}
