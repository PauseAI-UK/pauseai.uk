import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import type { Medium } from "./coverage";
import {
  addFind,
  addPiece,
  editFind,
  editPiece,
  pressPage,
  removePiece,
  restorePiece,
  turnDownFind,
  type PieceEdit,
} from "./finds.server";

const BY = "jo@pauseai.uk";

type TestPiece = {
  title: string;
  url?: string;
  links?: { label: string; url: string }[];
  published?: string;
  medium?: Medium;
  note?: string;
  state?: "shown" | "removed";
  updatedAt?: string;
};

/** A piece of coverage under the outlet `outlet`, made if it's new; its id. */
async function addTestPiece(outlet: string, piece: TestPiece): Promise<number> {
  const [{ id: outletId }] = await query<{ id: number }>(
    `INSERT INTO press_outlets (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id::int`,
    [outlet],
  );
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO press_coverage (outlet_id, title, medium, url, links, published, note, state, updated_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'test') RETURNING id::int`,
    [
      outletId,
      piece.title,
      piece.medium ?? "Article",
      piece.url ?? null,
      piece.links ? JSON.stringify(piece.links) : null,
      piece.published ?? null,
      piece.note ?? null,
      piece.state ?? "shown",
      piece.updatedAt ?? null,
    ],
  );
  return id;
}

type TestFind = {
  title: string;
  /** The outlet as Google News names it. */
  outlet?: string;
  url?: string;
  published?: string;
  state?: "unread" | "known" | "waiting" | "not ours";
  medium?: Medium;
  /** The LLM's reason, with its verdict that the find is ours. */
  reason?: string;
  note?: string;
  passage?: string;
  /** Why its last try failed, as keptError keeps an outside service's failure. */
  failure?: { said: string; service: string; kind: string };
  edited?: boolean;
  foundAt?: string;
  decidedAt?: string;
  /** Its site, as the survey keeps it, which press_sources may know. */
  site?: string;
};

/** A find's Google link, which is its title's, as each test's finds have titles of their own. */
const googleLink = (title: string) => `https://news.google.com/rss/articles/${encodeURIComponent(title)}`;

/** A find of the survey's, waiting unless it says otherwise; its id. */
async function addTestFind(find: TestFind): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO press_finds (google_link, title, outlet_name, url, published, state, medium, verdict, org, reason,
       note, passage, read_failure, edited_at, found_at, decided_at, site)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id::int`,
    [
      googleLink(find.title),
      find.title,
      find.outlet ?? null,
      find.url ?? null,
      find.published ?? null,
      find.state ?? "waiting",
      find.medium ?? null,
      find.reason ? "ours" : null,
      find.reason ? "uk" : null,
      find.reason ?? null,
      find.note ?? null,
      find.passage ?? null,
      find.failure ? JSON.stringify(find.failure) : null,
      find.edited ? "2026-10-15T09:00:00Z" : null,
      find.foundAt ?? "2026-10-15T06:00:00Z",
      find.decidedAt ?? null,
      find.site ?? null,
    ],
  );
  return id;
}

/** A news site the survey has met, with its tier and the outlet it is, by name, as Claude judged it. */
async function addTestSource(site: string, tier: number | null, outlet?: string): Promise<void> {
  await query(
    `INSERT INTO press_sources (site, name, tier, outlet_id)
     VALUES ($1, $1, $2, (SELECT id FROM press_outlets WHERE name = $3))`,
    [site, tier, outlet ?? null],
  );
}

const audit = () => query("SELECT actor, action, details FROM audit_log ORDER BY id");

const outletCount = async () => (await query<{ n: number }>("SELECT count(*)::int AS n FROM press_outlets"))[0].n;

/** The piece a find was put on /press as. */
async function pieceOf(findId: number) {
  const [piece] = await query(
    `SELECT f.state, f.decided_by AS "decidedBy", f.decided_at IS NOT NULL AS decided, c.id::int,
            o.name AS outlet, c.title, c.medium, c.url, to_char(c.published, 'YYYY-MM-DD') AS date, c.note,
            c.created_by AS "createdBy"
       FROM press_finds f JOIN press_coverage c ON c.id = f.coverage_id JOIN press_outlets o ON o.id = c.outlet_id
      WHERE f.id = $1`,
    [findId],
  );
  return piece;
}

describeWithDatabase("pressPage", () => {
  useTestDatabase();

  it("lists the finds waiting and removed, the pieces shown and removed, and every outlet", async () => {
    await addTestPiece("TIME", { title: "Lawmakers accuse Google", url: "https://time.com/7313320/pledge/" });
    await addTestPiece("Example TV", {
      title: "Protest on camera",
      medium: "Video",
      url: "https://www.youtube.com/watch?v=one",
      published: "2026-09-16",
    });
    await addTestPiece("Example TV", {
      title: "Cross-posted",
      medium: "Video",
      links: [
        { label: "X", url: "https://x.com/exampletv/status/1" },
        { label: "Site", url: "https://www.exampletv.com/protest" },
      ],
    });
    // Two outlets' pieces are on examplewire.com, so neither is the site's.
    await addTestPiece("Example Wire", {
      title: "Wire piece",
      url: "https://www.examplewire.com/a",
      published: "2026-01-01",
    });
    await addTestPiece("Example Wire Sport", { title: "Sport piece", url: "https://www.examplewire.com/b" });
    await addTestPiece("The Example Gazette", {
      title: "Off since the third",
      url: "https://www.examplegazette.co.uk/off",
      state: "removed",
      updatedAt: "2026-10-03T10:00:00Z",
    });
    await addTestPiece("abc news", { title: "Off, never dated", url: "https://abcnews.example/off", state: "removed" });
    await addTestPiece("The Example Gazette", {
      title: "Off since the fourth",
      url: "https://www.examplegazette.co.uk/off-4",
      state: "removed",
      updatedAt: "2026-10-04T10:00:00Z",
    });

    const time = await addTestFind({
      title: "Google broke its pledge",
      outlet: "Time Magazine",
      url: "https://time.com/999/google/",
      published: "2026-10-14",
      reason: "Quotes PauseAI UK",
      passage: "PauseAI UK said",
    });
    const undated = await addTestFind({
      title: "Undated",
      failure: { said: "A news page couldn't be reached", service: "news-page", kind: "unreachable" },
    });
    const wire = await addTestFind({
      title: "On the wire",
      outlet: "Example Wire",
      url: "https://www.examplewire.com/c",
      published: "2026-10-12",
      medium: "Photos",
    });
    const edited = await addTestFind({
      title: "Edited by staff",
      outlet: "Time Magazine",
      url: "https://time.com/1000/edited/",
      published: "2026-10-14",
      note: "Staff's note",
      edited: true,
    });
    const youtube = await addTestFind({
      title: "On YouTube",
      outlet: "Some Channel",
      url: "https://youtu.be/two",
      state: "not ours",
      decidedAt: "2026-10-02T10:00:00Z",
    });
    const undecided = await addTestFind({
      title: "Not ours since it was found",
      outlet: "ETV",
      url: "https://www.exampletv.com/other",
      state: "not ours",
      foundAt: "2026-10-05T10:00:00Z",
    });
    await addTestFind({ title: "Still unread", state: "unread" });
    await addTestFind({ title: "Known", state: "known" });

    const page = await pressPage();
    expect(page.waiting).toEqual([
      {
        id: edited,
        title: "Edited by staff",
        // Staff named it, so it isn't the site's outlet.
        outlet: "Time Magazine",
        date: "2026-10-14",
        url: "https://time.com/1000/edited/",
        medium: "Article",
        verdict: null,
        org: null,
        reason: null,
        note: "Staff's note",
        passage: null,
        failure: null,
        tier: null,
        foundAt: new Date("2026-10-15T06:00:00Z"),
        decidedAt: new Date("2026-10-15T06:00:00Z"),
      },
      {
        id: time,
        title: "Google broke its pledge",
        // TIME's pieces are on time.com, whatever Google News calls it.
        outlet: "TIME",
        date: "2026-10-14",
        url: "https://time.com/999/google/",
        medium: "Article",
        verdict: "ours",
        org: "uk",
        reason: "Quotes PauseAI UK",
        note: null,
        passage: "PauseAI UK said",
        failure: null,
        tier: null,
        foundAt: new Date("2026-10-15T06:00:00Z"),
        decidedAt: new Date("2026-10-15T06:00:00Z"),
      },
      expect.objectContaining({ id: wire, outlet: "Example Wire", medium: "Photos" }),
      expect.objectContaining({
        id: undated,
        // With no outlet or address of its own, it's under its Google link's site.
        outlet: "news.google.com",
        date: null,
        url: googleLink("Undated"),
        medium: "Article",
        // Without its words, which staff are never shown.
        failure: { service: "news-page", kind: "unreachable" },
      }),
    ]);
    expect(page.notOurs).toEqual([
      expect.objectContaining({
        id: undecided,
        // Example TV's alone are on exampletv.com, in its cross-posted piece's links.
        outlet: "Example TV",
        decidedAt: new Date("2026-10-05T10:00:00Z"),
      }),
      // YouTube is shared, so Example TV's video there doesn't make this Example TV's.
      expect.objectContaining({ id: youtube, outlet: "Some Channel", medium: "Video" }),
    ]);
    expect(page.shown.map((piece) => piece.title)).toEqual([
      "Protest on camera",
      "Wire piece",
      "Lawmakers accuse Google",
      "Cross-posted",
      "Sport piece",
    ]);
    expect(page.shown[0]).toMatchObject({
      outlet: "Example TV",
      title: "Protest on camera",
      url: "https://www.youtube.com/watch?v=one",
      links: null,
      date: "2026-09-16",
      medium: "Video",
      note: null,
      tier: null,
    });
    expect(page.removed.map((piece) => [piece.title, piece.removedAt])).toEqual([
      ["Off since the fourth", new Date("2026-10-04T10:00:00Z")],
      ["Off since the third", new Date("2026-10-03T10:00:00Z")],
      ["Off, never dated", null],
    ]);
    expect(page.outlets).toEqual([
      "abc news",
      "Example TV",
      "Example Wire",
      "Example Wire Sport",
      "The Example Gazette",
      "TIME",
    ]);
  });

  it("shows each find's source's tier, and each piece's outlet's best, the finds waiting newest first", async () => {
    await addTestPiece("TIME", { title: "On TIME", url: "https://time.com/1/" });
    await addTestPiece("Example Wire", { title: "On the wire", url: "https://www.examplewire.com/1" });
    await addTestSource("time.com", 2, "TIME");
    // Another of TIME's sites is worth more.
    await addTestSource("time.co.uk", 1, "TIME");
    await addTestSource("examplegazette.co.uk", 1);
    await addTestSource("examplewire.com", 4);
    await addTestSource("news.example.org", null);
    const site = (url: string) => ({ url, site: new URL(url).hostname.replace(/^www\./, "") });
    const wire = await addTestFind({
      title: "Wire",
      published: "2026-10-16",
      ...site("https://www.examplewire.com/2"),
    });
    const unknown = await addTestFind({
      title: "Unknown",
      published: "2026-10-13",
      ...site("https://news.example.org/a"),
    });
    const unmet = await addTestFind({ title: "Unmet", published: "2026-10-15", url: "https://unmet.example/a" });
    const time = await addTestFind({ title: "Time", published: "2026-10-14", ...site("https://time.com/2/") });
    const gazette = await addTestFind({
      title: "Gazette",
      published: "2026-10-01",
      ...site("https://www.examplegazette.co.uk/a"),
    });
    const removed = await addTestFind({ title: "Removed", state: "not ours", ...site("https://time.com/3/") });

    const page = await pressPage();
    // By date, whatever the tier; a site with no tier, or none kept, has none.
    expect(page.waiting.map(({ id, tier }) => [id, tier])).toEqual([
      [wire, 4],
      [unmet, null],
      [time, 2],
      [unknown, null],
      [gazette, 1],
    ]);
    expect(page.notOurs).toMatchObject([{ id: removed, tier: 2 }]);
    expect(page.shown.map(({ outlet, tier }) => [outlet, tier])).toEqual([
      ["TIME", 1],
      ["Example Wire", null],
    ]);
  });

  it("puts a find under the outlet Claude matched its site to, before one whose pieces are there, unless staff named one", async () => {
    // The Example Gazette Group's pieces are on its site, but Claude matched the site to The Example Gazette.
    await addTestPiece("The Example Gazette Group", { title: "Earlier", url: "https://www.examplegazette.co.uk/old" });
    await query("INSERT INTO press_outlets (name) VALUES ('The Example Gazette')");
    await addTestSource("examplegazette.co.uk", 3, "The Example Gazette");
    // A site Claude matched to no outlet is the outlet's whose pieces are there.
    await addTestPiece("Example Weekly", { title: "Earlier", url: "https://www.exampleweekly.com/old" });
    await addTestSource("exampleweekly.com", 3);
    const gazette = await addTestFind({
      title: "Matched",
      outlet: "Gazette Online",
      url: "https://www.examplegazette.co.uk/new",
      site: "examplegazette.co.uk",
    });
    const edited = await addTestFind({
      title: "Named by staff",
      outlet: "Gazette Online",
      url: "https://www.examplegazette.co.uk/edited",
      site: "examplegazette.co.uk",
      edited: true,
    });
    const weekly = await addTestFind({
      title: "Unmatched",
      outlet: "Weekly",
      url: "https://www.exampleweekly.com/new",
      site: "exampleweekly.com",
    });
    expect(Object.fromEntries((await pressPage()).waiting.map(({ id, outlet }) => [id, outlet]))).toEqual({
      [gazette]: "The Example Gazette",
      [edited]: "Gazette Online",
      [weekly]: "Example Weekly",
    });
    expect(await addFind(gazette, BY)).toBe(true);
    expect(await pieceOf(gazette)).toMatchObject({ outlet: "The Example Gazette" });
  });
});

describeWithDatabase("addFind", () => {
  useTestDatabase();

  it("puts a find on /press under the outlet whose pieces are on its site, with the LLM's reason as its note", async () => {
    await addTestPiece("TIME", { title: "Lawmakers accuse Google", url: "https://time.com/7313320/pledge/" });
    const id = await addTestFind({
      title: "Google broke its pledge",
      outlet: "Time Magazine",
      url: "https://time.com/999/google/",
      published: "2026-10-14",
      reason: "Quotes PauseAI UK",
    });
    expect(await addFind(id, BY)).toBe(true);
    const piece = await pieceOf(id);
    expect(piece).toEqual({
      state: "added",
      decidedBy: BY,
      decided: true,
      id: 2,
      outlet: "TIME",
      title: "Google broke its pledge",
      medium: "Article",
      url: "https://time.com/999/google/",
      date: "2026-10-14",
      note: "Quotes PauseAI UK",
      createdBy: BY,
    });
    expect(await outletCount()).toBe(1);
    expect(await audit()).toEqual([
      {
        actor: BY,
        action: "add press find",
        details: {
          findId: id,
          coverageId: 2,
          title: "Google broke its pledge",
          article: "https://time.com/999/google/",
        },
      },
    ]);
  });

  it("puts a find staff edited under the outlet they named, made as it's new, with their note", async () => {
    await addTestPiece("TIME", { title: "Lawmakers accuse Google", url: "https://time.com/7313320/pledge/" });
    const id = await addTestFind({
      title: "Edited by staff",
      outlet: "Time Magazine",
      url: "https://time.com/1000/edited/",
      reason: "Quotes PauseAI UK",
      note: "Staff's note",
      edited: true,
    });
    expect(await addFind(id, BY)).toBe(true);
    expect(await pieceOf(id)).toMatchObject({ outlet: "Time Magazine", note: "Staff's note", date: null });
    expect(await outletCount()).toBe(2);
  });

  it("puts a find on a shared site under the outlet Google names, whatever its case, not the site's", async () => {
    await addTestPiece("Example TV", { title: "Protest", medium: "Video", url: "https://www.youtube.com/watch?v=one" });
    await query("INSERT INTO press_outlets (name) VALUES ('Some Channel')");
    const id = await addTestFind({
      title: "On YouTube",
      outlet: "SOME CHANNEL",
      url: "https://www.youtube.com/watch?v=two",
    });
    expect(await addFind(id, BY)).toBe(true);
    // Its kind is from its address, as the survey stored none.
    expect(await pieceOf(id)).toMatchObject({ outlet: "Some Channel", medium: "Video", note: null });
    expect(await outletCount()).toBe(2);
  });

  it("puts a find with no outlet named under its site, and a removed find too", async () => {
    const id = await addTestFind({
      title: "Removed, then added",
      url: "https://www.examplewire.com/seoul",
      medium: "Photos",
      state: "not ours",
    });
    expect(await addFind(id, BY)).toBe(true);
    // The kind the survey stored wins over the address's.
    expect(await pieceOf(id)).toMatchObject({ outlet: "examplewire.com", medium: "Photos" });
  });

  it("adds nothing for a find that's not waiting or removed, as someone added it since the page loaded", async () => {
    const id = await addTestFind({ title: "Added already", url: "https://www.examplewire.com/a" });
    expect(await addFind(id, BY)).toBe(true);
    expect(await addFind(id, BY)).toBe(false);
    expect(await addFind(await addTestFind({ title: "Unread", state: "unread" }), BY)).toBe(false);
    expect(await query("SELECT count(*)::int AS n FROM press_coverage")).toEqual([{ n: 1 }]);
    expect(await audit()).toHaveLength(1);
  });
});

describeWithDatabase("editFind", () => {
  useTestDatabase();

  const asItIs: PieceEdit = {
    title: "Google broke its pledge",
    date: "2026-10-14",
    note: "Quotes PauseAI UK",
    medium: "Article",
    outlet: "TIME",
  };

  it("sets what a find goes on /press with, and logs what changed", async () => {
    await addTestPiece("TIME", { title: "Lawmakers accuse Google", url: "https://time.com/7313320/pledge/" });
    const id = await addTestFind({
      title: "Google broke its pledge",
      outlet: "Time Magazine",
      url: "https://time.com/999/google/",
      published: "2026-10-14",
      reason: "Quotes PauseAI UK",
    });
    const edit: PieceEdit = {
      ...asItIs,
      title: "Google broke its AI pledge",
      outlet: "Time Magazine",
      medium: "Video",
    };
    expect(await editFind(id, edit, BY)).toBe(true);
    expect(
      await query(
        `SELECT title, to_char(published, 'YYYY-MM-DD') AS date, note, medium, outlet_name AS outlet,
                edited_at IS NOT NULL AS edited
           FROM press_finds`,
      ),
    ).toEqual([{ ...edit, edited: true }]);
    expect(await audit()).toEqual([
      {
        actor: BY,
        action: "edit press find",
        details: {
          findId: id,
          title: "Google broke its AI pledge",
          changed: {
            title: ["Google broke its pledge", "Google broke its AI pledge"],
            medium: ["Article", "Video"],
            outlet: ["TIME", "Time Magazine"],
          },
        },
      },
    ]);
    // Staff named its outlet, so it stays theirs though TIME's pieces are on its site.
    expect((await pressPage()).waiting).toMatchObject([{ id, outlet: "Time Magazine", medium: "Video" }]);
  });

  it("logs nothing when nothing changed", async () => {
    await addTestPiece("TIME", { title: "Lawmakers accuse Google", url: "https://time.com/7313320/pledge/" });
    const id = await addTestFind({
      title: "Google broke its pledge",
      outlet: "Time Magazine",
      url: "https://time.com/999/google/",
      published: "2026-10-14",
      reason: "Quotes PauseAI UK",
      state: "not ours",
    });
    expect(await editFind(id, asItIs, BY)).toBe(true);
    expect(await query("SELECT edited_at FROM press_finds")).toEqual([{ edited_at: null }]);
    expect(await audit()).toEqual([]);
  });

  it("edits nothing once the find is added", async () => {
    const id = await addTestFind({ title: "Added", url: "https://www.examplewire.com/a" });
    await addFind(id, BY);
    expect(await editFind(id, { ...asItIs, title: "Too late" }, BY)).toBe(false);
    expect(await query("SELECT title FROM press_finds")).toEqual([{ title: "Added" }]);
    expect(await audit()).toHaveLength(1);
  });
});

describeWithDatabase("turnDownFind", () => {
  useTestDatabase();

  it("keeps a waiting find as not ours, and logs it", async () => {
    const id = await addTestFind({ title: "Not ours after all", url: "https://www.examplewire.com/a" });
    expect(await turnDownFind(id, BY)).toBe(true);
    expect(await query("SELECT state, decided_by, decided_at IS NOT NULL AS decided FROM press_finds")).toEqual([
      { state: "not ours", decided_by: BY, decided: true },
    ]);
    expect(await audit()).toEqual([
      { actor: BY, action: "remove press find", details: { findId: id, title: "Not ours after all" } },
    ]);
  });

  it("does nothing to a find that isn't waiting, as someone decided it since the page loaded", async () => {
    const id = await addTestFind({ title: "Removed already", state: "not ours" });
    expect(await turnDownFind(id, BY)).toBe(false);
    expect(await query("SELECT decided_by FROM press_finds")).toEqual([{ decided_by: null }]);
    expect(await audit()).toEqual([]);
  });
});

describeWithDatabase("editPiece", () => {
  useTestDatabase();

  const asItIs: PieceEdit = {
    title: "Protest on camera",
    date: "2026-09-16",
    note: null,
    medium: "Video",
    outlet: "Example TV",
  };

  it("sets a piece's headline, date, note, kind and outlet, making the outlet if it's new, and logs what changed", async () => {
    const id = await addTestPiece("Example TV", {
      title: "Protest on camera",
      medium: "Video",
      url: "https://www.youtube.com/watch?v=one",
      published: "2026-09-16",
    });
    const edit: PieceEdit = { ...asItIs, date: null, note: "Interviews Jane Smith", outlet: "Example TV News" };
    expect(await editPiece(id, edit, BY)).toBe(true);
    expect(
      await query(
        `SELECT c.title, to_char(c.published, 'YYYY-MM-DD') AS date, c.note, c.medium, o.name AS outlet,
                c.updated_by AS "updatedBy", c.updated_at IS NOT NULL AS updated
           FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id`,
      ),
    ).toEqual([{ ...edit, updatedBy: BY, updated: true }]);
    expect(await audit()).toEqual([
      {
        actor: BY,
        action: "edit press piece",
        details: {
          coverageId: id,
          title: "Protest on camera",
          changed: {
            date: ["2026-09-16", null],
            note: [null, "Interviews Jane Smith"],
            outlet: ["Example TV", "Example TV News"],
          },
        },
      },
    ]);
  });

  it("logs nothing when nothing changed", async () => {
    const id = await addTestPiece("Example TV", {
      title: "Protest on camera",
      medium: "Video",
      url: "https://www.youtube.com/watch?v=one",
      published: "2026-09-16",
    });
    expect(await editPiece(id, asItIs, BY)).toBe(true);
    expect(await query("SELECT updated_by FROM press_coverage")).toEqual([{ updated_by: null }]);
    expect(await audit()).toEqual([]);
  });

  it("edits nothing once the piece is off /press", async () => {
    const id = await addTestPiece("Example TV", {
      title: "Protest on camera",
      url: "https://www.youtube.com/watch?v=one",
      state: "removed",
    });
    expect(await editPiece(id, { ...asItIs, title: "Too late" }, BY)).toBe(false);
    expect(await query("SELECT title FROM press_coverage")).toEqual([{ title: "Protest on camera" }]);
    expect(await audit()).toEqual([]);
  });
});

describeWithDatabase("addPiece", () => {
  useTestDatabase();

  const piece = {
    title: "Found it myself",
    date: "2026-10-01",
    note: "Quotes Jane Smith",
    medium: "Article",
    outlet: "the example gazette",
    url: "https://www.examplegazette.co.uk/news/found",
  } satisfies PieceEdit & { url: string };

  it("puts a piece staff found on /press, under the outlet named, whatever its case, and logs it", async () => {
    await addTestPiece("The Example Gazette", { title: "Earlier", url: "https://www.examplegazette.co.uk/earlier" });
    const id = await addPiece(piece, BY);
    expect(id).toBe(2);
    expect(
      await query(
        `SELECT o.name AS outlet, c.title, c.medium, c.url, to_char(c.published, 'YYYY-MM-DD') AS date, c.note,
                c.state, c.created_by AS "createdBy"
           FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id WHERE c.id = $1`,
        [id],
      ),
    ).toEqual([{ ...piece, outlet: "The Example Gazette", state: "shown", createdBy: BY }]);
    expect(await outletCount()).toBe(1);
    expect(await audit()).toEqual([
      {
        actor: BY,
        action: "add press piece",
        details: { coverageId: 2, title: "Found it myself", article: "https://www.examplegazette.co.uk/news/found" },
      },
    ]);
  });

  it("makes the outlet named if it's new", async () => {
    expect(await addPiece({ ...piece, outlet: "Example Weekly" }, BY)).toBe(1);
    expect(await query("SELECT name FROM press_outlets")).toEqual([{ name: "Example Weekly" }]);
  });

  it("says a piece whose address the coverage has already, shown or removed, is known, adding nothing", async () => {
    await addTestPiece("The Example Gazette", {
      title: "Removed",
      url: "https://examplegazette.co.uk/news/found/",
      state: "removed",
    });
    await addTestPiece("Example TV", {
      title: "Cross-posted",
      medium: "Video",
      links: [
        { label: "X", url: "https://x.com/exampletv/status/1" },
        { label: "YouTube", url: "https://www.youtube.com/watch?v=one" },
      ],
    });
    // The same article, as urlKey compares addresses: with tracking, or www., or a trailing slash.
    expect(await addPiece({ ...piece, url: "https://www.examplegazette.co.uk/news/found?utm_source=x" }, BY)).toBe(
      "known",
    );
    expect(await addPiece({ ...piece, url: "https://youtube.com/watch?v=one#t=3" }, BY)).toBe("known");
    expect(await query("SELECT count(*)::int AS n FROM press_coverage")).toEqual([{ n: 2 }]);
    expect(await audit()).toEqual([]);
  });
});

describeWithDatabase("removePiece and restorePiece", () => {
  useTestDatabase();

  it("takes a piece off /press and puts it back, logging each", async () => {
    const id = await addTestPiece("Example TV", { title: "Protest", url: "https://www.youtube.com/watch?v=one" });
    const state = async () => query('SELECT state, updated_by AS "updatedBy" FROM press_coverage');
    expect(await removePiece(id, BY)).toBe(true);
    expect(await state()).toEqual([{ state: "removed", updatedBy: BY }]);
    // Off already.
    expect(await removePiece(id, "sam@pauseai.uk")).toBe(false);
    expect(await state()).toEqual([{ state: "removed", updatedBy: BY }]);
    expect(await restorePiece(id, "sam@pauseai.uk")).toBe(true);
    expect(await state()).toEqual([{ state: "shown", updatedBy: "sam@pauseai.uk" }]);
    // On already.
    expect(await restorePiece(id, BY)).toBe(false);
    expect(await audit()).toEqual([
      { actor: BY, action: "remove press piece", details: { coverageId: id, title: "Protest" } },
      { actor: "sam@pauseai.uk", action: "restore press piece", details: { coverageId: id, title: "Protest" } },
    ]);
  });
});
