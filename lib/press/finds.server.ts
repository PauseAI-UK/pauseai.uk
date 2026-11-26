import "server-only";
import { changedFields } from "@/lib/field-changes";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction, type Queryable } from "@/lib/server/db.server";
import type { Medium } from "./coverage";
import type { FindFailure } from "./finds";
import { TIER_UNKNOWN, type Tier } from "./sources";
import type { FindOrg, Verdict } from "./review";
import { mediumOf } from "./medium";
import { hostOf, urlKey } from "./urls";

// The staff Press page (/staff/press): what the press survey found that's
// waiting for staff, the coverage on /press, and what's not on it, and
// what staff decide of each. Any staff member can.

/** A find waiting for staff, or removed. */
export type Find = {
  id: number;
  title: string;
  /** The outlet it would go under on /press (outletFor). */
  outlet: string;
  date: string | null;
  /** The article's own address, or Google's link while it couldn't be decoded. */
  url: string;
  /** What kind of piece it is, as the survey made out when it read it, else from its address. */
  medium: Medium;
  verdict: Verdict | null;
  org: FindOrg | null;
  reason: string | null;
  /** What staff wrote of it, to be its note on /press in place of the LLM's reason. */
  note: string | null;
  passage: string | null;
  /** Its site's tier, none if Claude didn't know it (press_sources). */
  tier: Tier | null;
  /** Why it couldn't be read, when it was left for staff after its last try. */
  failure: FindFailure | null;
  foundAt: Date;
  /** When staff or the survey last decided it, else when it was found. */
  decidedAt: Date;
};

/** A piece on /press, as staff edit it: at one address, or cross-posted to several, as press_coverage requires. */
export type ShownPiece = {
  id: number;
  outlet: string;
  title: string;
  date: string | null;
  medium: Medium;
  note: string | null;
  /** Its outlet's tier, the best of its sites', none if it has none (press_sources). */
  tier: Tier | null;
} & ({ url: string; links: null } | { url: null; links: [PieceLink, ...PieceLink[]] });

/** One of the platforms a cross-posted piece is on. */
export type PieceLink = { label: string; url: string };

/** A piece taken off /press, and when. */
export type RemovedPiece = ShownPiece & { removedAt: Date };

export type PressPage = {
  waiting: Find[];
  shown: ShownPiece[];
  notOurs: Find[];
  removed: RemovedPiece[];
  /** Every outlet's name, in English order, to choose from when editing a piece. */
  outlets: string[];
};

const FIND_COLUMNS = `f.id::int, f.title, f.outlet_name AS "outletName", f.edited_at IS NOT NULL AS edited,
  to_char(f.published, 'YYYY-MM-DD') AS date, COALESCE(f.url, f.google_link) AS url, f.medium, f.verdict, f.org,
  f.reason, f.note, f.passage, f.read_failure - 'said' AS failure, f.found_at AS "foundAt",
  COALESCE(f.decided_at, f.found_at) AS "decidedAt", s.tier, so.name AS "sourceOutlet"`;

/** Each find with its source: its site's tier, and the outlet on /press its site is (press_sources). */
const FINDS = `press_finds f LEFT JOIN press_sources s ON s.site = f.site
  LEFT JOIN press_outlets so ON so.id = s.outlet_id`;

/** A find as it's kept: the outlet as Google News or staff named it, and no kind if it was found before the survey stored one. */
type FindRow = Omit<Find, "medium" | "outlet"> & {
  medium: Medium | null;
  outletName: string | null;
  edited: boolean;
  /** The outlet on /press its site is, as Claude matched it. */
  sourceOutlet: string | null;
};

/** A find as staff see it, with the outlet and kind it would go on /press with. */
function asFind({ outletName, edited, sourceOutlet, ...find }: FindRow, sites: Map<string, string>): Find {
  return {
    ...find,
    outlet: outletFor({ outletName, edited, sourceOutlet, url: find.url }, sites),
    medium: find.medium ?? mediumOf(find.url),
  };
}

/** Everything the staff Press page shows. */
export async function pressPage(): Promise<PressPage> {
  const pieces = (state: "shown" | "removed") =>
    `SELECT c.id::int, o.name AS outlet, c.title, c.url, c.links, to_char(c.published, 'YYYY-MM-DD') AS date,
            c.medium, c.note, c.updated_at AS "removedAt",
            (SELECT min(tier) FROM press_sources WHERE outlet_id = o.id) AS tier
       FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id
      WHERE c.state = '${state}'`;
  const [waiting, shown, notOurs, removed, outlets, sites] = await Promise.all([
    query<FindRow>(
      // The sources worth most first, a site with no tier as the third.
      `SELECT ${FIND_COLUMNS} FROM ${FINDS} WHERE f.state = 'waiting'
        ORDER BY COALESCE(s.tier, ${TIER_UNKNOWN}), f.published DESC NULLS LAST, f.id DESC`,
    ),
    query<ShownPiece>(`${pieces("shown")} ORDER BY c.published DESC NULLS LAST, c.id`),
    query<FindRow>(
      `SELECT ${FIND_COLUMNS} FROM ${FINDS} WHERE f.state = 'not ours'
        ORDER BY COALESCE(f.decided_at, f.found_at) DESC, f.id DESC LIMIT 100`,
    ),
    query<RemovedPiece>(`${pieces("removed")} ORDER BY c.updated_at DESC NULLS LAST, c.id DESC`),
    query<{ name: string }>("SELECT name FROM press_outlets ORDER BY name COLLATE english"),
    outletsBySite(),
  ]);
  return {
    waiting: waiting.map((find) => asFind(find, sites)),
    shown,
    notOurs: notOurs.map((find) => asFind(find, sites)),
    removed,
    outlets: outlets.map((outlet) => outlet.name),
  };
}

/** Sites many outlets post on, or copy others' pieces to, so a piece's site there doesn't say whose it is. */
const SHARED_SITES = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "tiktok.com",
  "open.spotify.com",
  "aol.co.uk",
  "aol.com",
  "msn.com",
  "yahoo.com",
  "news.yahoo.com",
  "uk.news.yahoo.com",
  "news.google.com",
  "reutersconnect.com",
];

/** Each site the coverage is on, but for shared ones, with the outlet whose pieces are there, where one outlet's alone are. */
async function outletsBySite(db?: Queryable): Promise<Map<string, string>> {
  const rows = await query<{ outlet: string; url: string }>(
    `SELECT o.name AS outlet, c.url FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id WHERE c.url IS NOT NULL
     UNION SELECT o.name, link->>'url' FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id,
       jsonb_array_elements(c.links) AS link`,
    [],
    db,
  );
  const outlets = new Map<string, Set<string>>();
  for (const row of rows) {
    const site = hostOf(row.url);
    if (!SHARED_SITES.includes(site)) outlets.set(site, (outlets.get(site) ?? new Set()).add(row.outlet));
  }
  return new Map([...outlets].flatMap(([site, names]) => (names.size === 1 ? [[site, [...names][0]]] : [])));
}

/**
 * The outlet a find goes under on /press: the one staff named, if they
 * edited it; else the one Claude matched its site to; else the one whose
 * pieces are on its site (TIME's for time.com, though Google News calls it
 * Time Magazine); else the one Google News names; else its site.
 */
function outletFor(
  find: { outletName: string | null; edited: boolean; sourceOutlet: string | null; url: string },
  sites: Map<string, string>,
): string {
  const named = find.outletName ?? hostOf(find.url);
  return find.edited ? named : (find.sourceOutlet ?? sites.get(hostOf(find.url)) ?? named);
}

/** The outlet named `name`, whatever its case, made if there's none. */
async function outletNamed(name: string, db: Queryable): Promise<number> {
  const [found] = await query<{ id: number }>(
    "SELECT id::int FROM press_outlets WHERE lower(name) = lower($1)",
    [name],
    db,
  );
  if (found) return found.id;
  const [made] = await query<{ id: number }>(
    "INSERT INTO press_outlets (name) VALUES ($1) RETURNING id::int",
    [name],
    db,
  );
  return made.id;
}

/** A find waiting, or removed, as staff see it; none if it's neither, as someone added it since the page loaded. */
async function decidable(id: number, db: Queryable): Promise<Find | undefined> {
  const [row] = await query<FindRow>(
    `SELECT ${FIND_COLUMNS} FROM ${FINDS} WHERE f.id = $1 AND f.state IN ('waiting', 'not ours') FOR UPDATE OF f`,
    [id],
    db,
  );
  return row && asFind(row, await outletsBySite(db));
}

/**
 * Puts a find waiting, or removed, on /press, under its outlet (outletFor),
 * made if it's new, and with staff's note, else the LLM's reason. False if
 * it's neither, as someone added it since the page loaded.
 */
export async function addFind(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const find = await decidable(id, db);
    if (!find) return false;
    const outletId = await outletNamed(find.outlet, db);
    const [{ coverageId }] = await query<{ coverageId: number }>(
      `INSERT INTO press_coverage (outlet_id, title, medium, url, published, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::int AS "coverageId"`,
      [outletId, find.title, find.medium, find.url, find.date, find.note ?? find.reason, by],
      db,
    );
    await query(
      `UPDATE press_finds SET state = 'added', coverage_id = $2, decided_by = $3, decided_at = now() WHERE id = $1`,
      [id, coverageId, by],
      db,
    );
    await logChange(by, "add press find", { findId: id, coverageId, title: find.title, article: find.url }, db);
    return true;
  });
}

/**
 * Sets what a find waiting, or removed, goes on /press with: its headline,
 * outlet, kind, date and note; logs what changed. False if it's neither.
 */
export async function editFind(id: number, edit: PieceEdit, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const find = await decidable(id, db);
    if (!find) return false;
    const was: PieceEdit = {
      title: find.title,
      date: find.date,
      note: find.note ?? find.reason,
      medium: find.medium,
      outlet: find.outlet,
    };
    const changed = changedFields(was, edit);
    if (Object.keys(changed).length === 0) return true;
    await query(
      `UPDATE press_finds SET title = $2, published = $3, note = $4, medium = $5, outlet_name = $6, edited_at = now()
       WHERE id = $1`,
      [id, edit.title, edit.date, edit.note, edit.medium, edit.outlet],
      db,
    );
    await logChange(by, "edit press find", { findId: id, title: edit.title, changed }, db);
    return true;
  });
}

/** Removes a waiting find: it's kept, as not ours, so it's never found again as new. False if it isn't waiting, as someone decided it since the page loaded. */
export async function turnDownFind(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [find] = await query<{ title: string }>(
      `UPDATE press_finds SET state = 'not ours', decided_by = $2, decided_at = now()
       WHERE id = $1 AND state = 'waiting' RETURNING title`,
      [id, by],
      db,
    );
    if (!find) return false;
    await logChange(by, "remove press find", { findId: id, title: find.title }, db);
    return true;
  });
}

/** What staff set of a piece on /press. */
export type PieceEdit = { title: string; date: string | null; note: string | null; medium: Medium; outlet: string };

/**
 * Sets a piece's headline, date, note, kind and outlet, an outlet by name,
 * made if it's new; logs what changed. False if it's no longer on /press.
 */
export async function editPiece(id: number, edit: PieceEdit, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [was] = await query<PieceEdit>(
      `SELECT c.title, to_char(c.published, 'YYYY-MM-DD') AS date, c.note, c.medium, o.name AS outlet
         FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id
        WHERE c.id = $1 AND c.state = 'shown' FOR UPDATE OF c`,
      [id],
      db,
    );
    if (!was) return false;
    const changed = changedFields(was, edit);
    if (Object.keys(changed).length === 0) return true;
    const outletId = await outletNamed(edit.outlet, db);
    await query(
      `UPDATE press_coverage SET title = $2, published = $3, note = $4, medium = $5, outlet_id = $6,
         updated_by = $7, updated_at = now()
       WHERE id = $1`,
      [id, edit.title, edit.date, edit.note, edit.medium, outletId, by],
      db,
    );
    await logChange(by, "edit press piece", { coverageId: id, title: edit.title, changed }, db);
    return true;
  });
}

/**
 * Puts a piece staff found themselves on /press, under the outlet named,
 * made if it's new. "known" if the coverage has its address already, shown
 * or removed, as urlKey compares addresses.
 */
export async function addPiece(piece: PieceEdit & { url: string }, by: string): Promise<number | "known"> {
  return transaction(async (db) => {
    const rows = await query<{ url: string }>(
      `SELECT url FROM press_coverage WHERE url IS NOT NULL
       UNION SELECT link->>'url' FROM press_coverage, jsonb_array_elements(links) AS link`,
      [],
      db,
    );
    const key = urlKey(piece.url);
    if (rows.some((row) => urlKey(row.url) === key)) return "known";
    const outletId = await outletNamed(piece.outlet, db);
    const [{ coverageId }] = await query<{ coverageId: number }>(
      `INSERT INTO press_coverage (outlet_id, title, medium, url, published, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::int AS "coverageId"`,
      [outletId, piece.title, piece.medium, piece.url, piece.date, piece.note, by],
      db,
    );
    await logChange(by, "add press piece", { coverageId, title: piece.title, article: piece.url }, db);
    return coverageId;
  });
}

/** Puts a piece taken off /press back on it. False if it's on already. */
export async function restorePiece(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [piece] = await query<{ title: string }>(
      `UPDATE press_coverage SET state = 'shown', updated_by = $2, updated_at = now()
       WHERE id = $1 AND state = 'removed' RETURNING title`,
      [id, by],
      db,
    );
    if (!piece) return false;
    await logChange(by, "restore press piece", { coverageId: id, title: piece.title }, db);
    return true;
  });
}

/** Takes a piece off /press. False if it's off already. */
export async function removePiece(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [piece] = await query<{ title: string }>(
      `UPDATE press_coverage SET state = 'removed', updated_by = $2, updated_at = now()
       WHERE id = $1 AND state = 'shown' RETURNING title`,
      [id, by],
      db,
    );
    if (!piece) return false;
    await logChange(by, "remove press piece", { coverageId: id, title: piece.title }, db);
    return true;
  });
}
