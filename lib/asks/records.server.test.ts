import { beforeEach, expect, it } from "vitest";
import { campaigns, copy } from "@/lib/content/email-your-mp";
import { migrate } from "@/scripts/db-migrate.mjs";
import {
  addTestMp,
  addTestPolitician,
  describeWithDatabase,
  MAKES_DATABASES,
  MIGRATION_ASKS,
  useDatabaseUpTo,
  useTestDatabase,
} from "@/tests/database";
import {
  addAsk,
  askPageData,
  askTitle,
  askToEdit,
  asksWithCounts,
  deleteAsk,
  editAsk,
  listAsks,
  listCampaigns,
} from "./records.server";
import { query } from "@/lib/server/db.server";
import { setStatus } from "@/lib/politicians/records.server";
import { INVITED } from "./asks";

describeWithDatabase("asks and campaigns", () => {
  useTestDatabase();

  it("gives an ask's page: its counts, its campaigns and mailings by date, and its answers by status", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ name: "Dora", email: "dora@parliament.uk", airtableId: "dora" });
    await setStatus(polly, "deepmind-letter", { status: "signed", date: null, note: "" }, "test");
    await setStatus(dora, "deepmind-letter", { status: "declined", date: null, note: "" }, "test");
    const [{ id }] = await query<{ id: number }>(
      // 00:30 on 1 July in London: the day its letters began.
      `INSERT INTO letters (kind, notable_person_id, status, sent_at) VALUES ('pauseai', $1, 'sent', '2025-06-30 23:30+00') RETURNING id::int AS id`,
      [polly],
    );
    await query(
      `INSERT INTO letters_from_pauseai (id, mailing_id) SELECT $1, id FROM mailings WHERE ask = 'deepmind-letter' LIMIT 1`,
      [id],
    );
    const ask = await askPageData("deepmind-letter");
    expect(ask).toMatchObject({
      writtenTo: 1,
      replied: 0,
      invited: 0,
      counts: { signed: 1, declined: 1 },
    });
    await query("UPDATE letters SET replied_at = now() WHERE id = $1", [id]);
    expect((await askPageData("deepmind-letter"))!.replied).toBe(1);
    expect(ask).toMatchObject({ firstLetter: "2025-07-01", lastLetter: "2025-07-01" });
    expect(ask!.mailings).toBeGreaterThan(0);
    expect(ask!.campaigns).toBeGreaterThan(0);
    // Campaigns first, then mailings, the latest of each first.
    expect(ask!.ways.map((way) => way.kind)).toEqual([...ask!.ways.map((way) => way.kind)].sort());
    expect(ask!.ways.find((way) => way.letters === 1)).toMatchObject({ kind: "mailing" });
    // A column each, with its first few people and how many of all of them are out of office.
    expect(ask!.groups.map((g) => [g.key, g.total, g.outOfOffice, g.people.map((p) => p.politicianId)])).toEqual([
      ["signed", 1, 0, [polly]],
      ["other", 0, 0, []],
      ["declined", 1, 0, [dora]],
    ]);
    expect(ask!.groups[0].people[0].personStatus).toBe("in_office");
    const write = async (person: number, sentAt: string, status = "sent") => {
      const [{ id: letter }] = await query<{ id: number }>(
        `INSERT INTO letters (kind, notable_person_id, status, sent_at) VALUES ('pauseai', $1, $3, $2) RETURNING id::int AS id`,
        [person, sentAt, status],
      );
      await query(
        `INSERT INTO letters_from_pauseai (id, mailing_id) SELECT $1, id FROM mailings WHERE ask = 'deepmind-letter' LIMIT 1`,
        [letter],
      );
    };
    const newer = await addTestPolitician({ name: "Newer", email: "newer@parliament.uk", airtableId: "newer" });
    const older = await addTestPolitician({ name: "Older", email: "older@parliament.uk", airtableId: "older" });
    await addTestPolitician({ name: "Unwritten", email: "unwritten@parliament.uk", airtableId: "unwritten" });
    const bounced = await addTestPolitician({ name: "Bounced", email: "bounced@parliament.uk", airtableId: "bounced" });
    await write(newer, "2025-08-02");
    await write(older, "2025-08-01");
    // A letter that bounced, or was stopped before it went, never put the ask to them.
    await write(bounced, "2025-08-03", "bounced");
    await write(bounced, "2025-08-04", "cancelled");
    // Those invited, first: only someone a letter reached counts, and only until they answer, oldest first.
    const invited = (await askPageData("deepmind-letter"))!;
    expect(invited).toMatchObject({ invited: 2, writtenTo: 3 });
    expect(invited.groups[0]).toMatchObject({ key: INVITED, total: 2, outOfOffice: 0 });
    expect(invited.groups[0].people.map((a) => [a.politicianId, a.status])).toEqual([
      [older, INVITED],
      [newer, INVITED],
    ]);
    expect((await asksWithCounts()).find((a) => a.slug === "deepmind-letter")!.invited).toBe(2);
    // Staff mark as invited someone asked another way, and someone a letter reached too, who is still counted once.
    // Neither is an answer. One marked has no letter's date, and comes by when they were marked. One who has
    // retired is counted as out of office.
    const marked = await addTestPolitician({ name: "Marked", email: "marked@parliament.uk", airtableId: "marked" });
    await query("UPDATE notable_people SET status = 'retired' WHERE id = $1", [marked]);
    await setStatus(marked, "deepmind-letter", { status: INVITED, date: null, note: "Asked in person" }, "test");
    await setStatus(newer, "deepmind-letter", { status: INVITED, date: null, note: "And by phone" }, "test");
    const both = (await askPageData("deepmind-letter"))!;
    expect(both).toMatchObject({ invited: 3, counts: { signed: 1, declined: 1 } });
    expect(both.groups[0]).toMatchObject({ key: INVITED, total: 3, outOfOffice: 1 });
    expect(both.groups[0].people.map((a) => [a.politicianId, a.status, a.note, a.personStatus])).toEqual([
      [older, INVITED, "", "in_office"],
      [newer, INVITED, "And by phone", "in_office"],
      [marked, INVITED, "Asked in person", "retired"],
    ]);
    // A test politician is in none of its counts or columns, as the politicians list leaves them out.
    const test = await addTestMp();
    await setStatus(test, "deepmind-letter", { status: "signed", date: null, note: "" }, "test");
    await write(test, "2025-08-05");
    await query("UPDATE letters SET replied_at = now() WHERE notable_person_id = $1", [test]);
    const without = (await askPageData("deepmind-letter"))!;
    expect(without).toMatchObject({ invited: 3, writtenTo: 3, replied: 1, counts: { signed: 1, declined: 1 } });
    expect(without.groups.flatMap((g) => g.people.map((p) => p.politicianId))).not.toContain(test);
    // A column shows only its first few.
    for (const n of [1, 2, 3, 4, 5]) {
      const one = await addTestPolitician({
        name: `Many ${n}`,
        email: `many${n}@parliament.uk`,
        airtableId: `many${n}`,
      });
      await setStatus(one, "deepmind-letter", { status: "declined", date: null, note: "" }, "test");
    }
    const many = (await askPageData("deepmind-letter"))!.groups.find((g) => g.key === "declined")!;
    expect([many.total, many.people.length]).toEqual([6, 5]);
    expect(await askPageData("no-such-ask")).toBeUndefined();
    await addAsk({ title: "Ours", kind: "letter", date: null, url: null, askedBy: [] }, "jo@pauseai.uk");
    expect(await askTitle("ours")).toBe("Ours");
    expect(await askTitle("no-such-ask")).toBeUndefined();
    await deleteAsk("ours", "jo@pauseai.uk");
  });

  it("sets an event's answers in its columns, going, other and declined, each other with its note", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ name: "Dora", email: "dora@parliament.uk", airtableId: "dora" });
    const edinburgh = "edinburgh-conference-2026";
    await setStatus(polly, edinburgh, { status: "other", date: null, note: "Tentatively said yes" }, "test");
    await setStatus(dora, edinburgh, { status: "declined", date: null, note: "" }, "test");
    const ask = await askPageData(edinburgh);
    expect(ask!.groups.map((g) => [g.key, g.total, g.people.map((p) => [p.status, p.note])])).toEqual([
      ["going", 0, []],
      ["other", 1, [["other", "Tentatively said yes"]]],
      ["declined", 1, [["declined", ""]]],
    ]);
  });

  it("lists every ask, newest first, those without a date last", async () => {
    const asks = await listAsks();
    expect(asks.map((ask) => [ask.slug, ask.date])).toEqual([
      ["superintelligence-edm", "2026-11-10"],
      ["edinburgh-conference-2026", "2026-11-01"],
      ["go-to-parliament-oct-2026", "2026-10-20"],
      ["controlai-letter", "2026-09-11"],
      ["frontier-ai-letter", "2026-06-18"],
      ["deepmind-letter", "2025-08-29"],
      ["controlai-statement", "2025-02-06"],
    ]);
    expect(asks[1]).toEqual({
      slug: "edinburgh-conference-2026",
      title: expect.any(String),
      kind: "event",
      date: "2026-11-01",
      url: "https://luma.com/6jp2nqe9",
      askedBy: ["pauseai"],
    });
    expect(asks.map((ask) => ask.slug).sort()).toEqual(
      [
        "controlai-letter",
        "controlai-statement",
        "deepmind-letter",
        "edinburgh-conference-2026",
        "frontier-ai-letter",
        "go-to-parliament-oct-2026",
        "superintelligence-edm",
      ].sort(),
    );
  });

  it("names the test MPs' asks by their titles here", async () => {
    const titles = Object.fromEntries((await listAsks()).map((ask) => [ask.slug, ask.title]));
    for (const [ask, title] of Object.entries(copy.lookup.testMpAsks)) expect(titles[ask]).toBe(title);
  });

  it("counts each ask's answers", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ airtableId: "rec2", name: "Dora Dummy" });
    await setStatus(polly, "edinburgh-conference-2026", { status: "declined", date: null, note: "" }, "airtable");
    await setStatus(dora, "edinburgh-conference-2026", { status: "declined", date: null, note: "" }, "airtable");
    await setStatus(dora, "frontier-ai-letter", { status: "signed", date: null, note: "" }, "jo@pauseai.uk");
    const counts = Object.fromEntries((await asksWithCounts()).map((ask) => [ask.slug, ask.counts]));
    expect(counts["edinburgh-conference-2026"]).toEqual({ declined: 2 });
    expect(counts["frontier-ai-letter"]).toEqual({ signed: 1 });
    expect(counts["deepmind-letter"]).toEqual({});
    // Who asks each, as the migration sets it.
    const by = Object.fromEntries((await asksWithCounts()).map((ask) => [ask.slug, ask.askedBy]));
    expect(by).toEqual({
      "frontier-ai-letter": ["supporters"],
      "deepmind-letter": ["supporters"],
      "controlai-statement": ["controlai"],
      "controlai-letter": ["controlai"],
      "edinburgh-conference-2026": ["pauseai"],
      "go-to-parliament-oct-2026": ["supporters"],
      "superintelligence-edm": [],
    });
  });

  it("has a row for every campaign in code, with its title and ask", async () => {
    const rows = await listCampaigns();
    for (const campaign of campaigns) {
      expect(rows).toContainEqual({ slug: campaign.slug, title: campaign.title, ask: campaign.ask ?? null });
    }
    // And pauseai.info's old campaigns, which have no code.
    expect(rows.map((row) => row.slug)).toEqual(
      expect.arrayContaining(["pauseai-info-frontier-ai", "pauseai-info-liability", "pauseai-info-deepmind"]),
    );
  });
});

describeWithDatabase("staff's asks", () => {
  useTestDatabase();
  // The asks the migrations add stay; those a test added go.
  beforeEach(() => query("DELETE FROM asks WHERE slug <> ALL($1)", [MIGRATION_ASKS]));
  const JO = "jo@pauseai.uk";
  const RECEPTION = {
    title: "Winter reception",
    kind: "event" as const,
    date: "2026-12-09",
    url: null,
    askedBy: ["pauseai" as const],
  };
  const audit = () => query("SELECT actor, action, details FROM audit_log ORDER BY id");

  it("adds an ask, its slug from its title and month, numbered if it's taken, and logs it", async () => {
    expect(await addAsk(RECEPTION, JO)).toEqual({ saved: true, slug: "winter-reception-dec-2026" });
    expect(await addAsk(RECEPTION, JO)).toEqual({ saved: true, slug: "winter-reception-dec-2026-2" });
    expect(await addAsk(RECEPTION, JO)).toEqual({ saved: true, slug: "winter-reception-dec-2026-3" });
    expect(await askToEdit("winter-reception-dec-2026")).toEqual({
      slug: "winter-reception-dec-2026",
      ...RECEPTION,
      named: false,
      kindFixed: false,
      deletable: true,
    });
    expect((await audit())[0]).toEqual({
      actor: JO,
      action: "add ask",
      details: { slug: "winter-reception-dec-2026", ...RECEPTION },
    });
  });

  it("changes an ask but its slug, one the code names too; its kind only while no one has answered it", async () => {
    await addAsk(RECEPTION, JO);
    const slug = "winter-reception-dec-2026";
    expect(await editAsk(slug, { ...RECEPTION, title: "Reception", url: "https://luma.com/x" }, JO)).toEqual({
      saved: true,
      slug,
    });
    expect(await askToEdit(slug)).toMatchObject({ slug, title: "Reception", url: "https://luma.com/x" });
    const polly = await addTestPolitician();
    // Someone staff marked invited hasn't answered, so the kind can still change, and their mark follows it.
    await setStatus(polly, slug, { status: INVITED, date: null, note: "" }, JO);
    expect(await askToEdit(slug)).toMatchObject({ kindFixed: false, deletable: false });
    expect(await editAsk(slug, { ...RECEPTION, kind: "letter" }, JO)).toMatchObject({ saved: true });
    expect(await query("SELECT ask_kind, status FROM ask_statuses WHERE ask = $1", [slug])).toEqual([
      { ask_kind: "letter", status: INVITED },
    ]);
    expect(await deleteAsk(slug, JO)).toEqual({ saved: false, reason: "in-use" });
    expect(await editAsk(slug, RECEPTION, JO)).toMatchObject({ saved: true });
    await setStatus(polly, slug, { status: "going", date: null, note: "" }, JO);
    expect(await editAsk(slug, { ...RECEPTION, kind: "letter" }, JO)).toEqual({ saved: false, reason: "kind-in-use" });
    expect(await askToEdit(slug)).toMatchObject({ kindFixed: true, deletable: false });
    expect(await editAsk(slug, { ...RECEPTION, title: "Reception again" }, JO)).toMatchObject({ saved: true });
    expect(await editAsk("controlai-letter", { ...RECEPTION, kind: "letter", title: "Renamed" }, JO)).toEqual({
      saved: true,
      slug: "controlai-letter",
    });
    expect(await askToEdit("controlai-letter")).toMatchObject({ title: "Renamed", named: true, deletable: false });
    expect(await editAsk("nothing", RECEPTION, JO)).toEqual({ saved: false, reason: "gone" });
    expect(await askToEdit("nothing")).toBeUndefined();
  });

  it("deletes an ask nothing refers to, logging what it was; not one answered, in a mailing, or the code's", async () => {
    await addAsk(RECEPTION, JO);
    await addAsk({ ...RECEPTION, title: "Mailed" }, JO);
    await query(
      `INSERT INTO mailings (title, ask, audience, channel, state, airtable_sent_between)
       VALUES ('M', 'mailed-dec-2026', 'politicians', 'email', 'sent', '[2026-01-01,2026-01-02)')`,
    );
    expect(await deleteAsk("mailed-dec-2026", JO)).toEqual({ saved: false, reason: "in-use" });
    expect(await deleteAsk("frontier-ai-letter", JO)).toEqual({ saved: false, reason: "named" });
    expect(await deleteAsk("nothing", JO)).toEqual({ saved: false, reason: "gone" });
    expect(await deleteAsk("winter-reception-dec-2026", JO)).toEqual({
      saved: true,
      slug: "winter-reception-dec-2026",
    });
    expect(await askToEdit("winter-reception-dec-2026")).toBeUndefined();
    expect((await audit()).at(-1)).toEqual({
      actor: JO,
      action: "delete ask",
      details: { slug: "winter-reception-dec-2026", ...RECEPTION },
    });
  });
});

describeWithDatabase("migration 0141_ask_invited", MAKES_DATABASES, () => {
  const db = useDatabaseUpTo("0140");

  it("makes an other answer whose note says only no reply invited, on any ask, in the log too, and no other answer", async () => {
    const conference = "conference-in-parliament-nov-2026";
    await query("INSERT INTO asks (slug, title, kind) VALUES ($1, 'Conference', 'event')", [conference]);
    const people = await query<{ id: number }>(
      `INSERT INTO notable_people (kind, name) SELECT 'politician', 'Person ' || n FROM generate_series(1, 4) n
       RETURNING id::int AS id`,
    );
    const [waiting, spaced, interested, declined] = people.map((person) => person.id);
    const answers: [number, string, string, string][] = [
      [waiting, conference, "other", "no reply"],
      // However it's typed, and on another ask.
      [spaced, "edinburgh-conference-2026", "other", " No Reply "],
      // A note that says more is an answer, and so is a no with the same note.
      [interested, conference, "other", "said he'd go but no reply"],
      [declined, conference, "declined", "no reply"],
    ];
    for (const [person, ask, status, note] of answers) {
      await query(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, note, updated_by)
         VALUES ($1, $2, 'event', $3, $4, 'jo@pauseai.uk')`,
        [person, ask, status, note],
      );
      await query(`INSERT INTO audit_log (actor, action, details) VALUES ('jo@pauseai.uk', 'set status', $1)`, [
        JSON.stringify({ politicianId: person, ask, status, date: null, note }),
      ]);
    }
    expect(migrate(db.url, { appliedUpTo: "0140" })).toContain("0141_ask_invited");
    expect(await query("SELECT notable_person_id::int AS id, status, note FROM ask_statuses ORDER BY 1")).toEqual([
      { id: waiting, status: "invited", note: "no reply" },
      { id: spaced, status: "invited", note: " No Reply " },
      { id: interested, status: "other", note: "said he'd go but no reply" },
      { id: declined, status: "declined", note: "no reply" },
    ]);
    expect(
      await query(
        "SELECT (details ->> 'politicianId')::int AS id, details ->> 'status' AS status FROM audit_log ORDER BY 1",
      ),
    ).toEqual([
      { id: waiting, status: "invited" },
      { id: spaced, status: "invited" },
      { id: interested, status: "other" },
      { id: declined, status: "declined" },
    ]);
  });
});

describeWithDatabase("migration 0061_ask_links_whole", MAKES_DATABASES, () => {
  const db = useDatabaseUpTo("0060");

  it("puts the site's address in front of an ask's link that's a path of it, and leaves whole links alone", async () => {
    expect(migrate(db.url, { appliedUpTo: "0060" })).toContain("0061_ask_links_whole");
    expect(
      await query(
        "SELECT slug, url FROM asks WHERE slug IN ('frontier-ai-letter', 'deepmind-letter', 'controlai-letter') ORDER BY slug",
      ),
    ).toEqual([
      { slug: "controlai-letter", url: "https://controlai.org/uk-pm-letter" },
      { slug: "deepmind-letter", url: "https://pauseai.uk/campaigns/dear-sir-demis-2025" },
      { slug: "frontier-ai-letter", url: "https://pauseai.uk/pdfs/Frontier-AI-Open-Letter.pdf" },
    ]);
  });
});
