import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { notifications } from "@/tests/notifications";
import { NEWER_RUN, NIGHTLY, type PoliticianImport } from "@/lib/import-runs";
import { PARLIAMENT_MEMBERS } from "@/lib/server/fixtures/politician-lists";
import { query } from "@/lib/server/db.server";
import { listRuns } from "@/lib/server/import-runs.server";
import { editPoliticianDetails } from "./edits.server";
import { decideHeldImport, importPoliticians, isPoliticianImport } from "./imports.server";
import { politiciansCopy } from "./copy";
import { importRunsCopy } from "@/lib/import-runs-copy";

const JO = "jo@pauseai.uk";

const runs = (job: PoliticianImport["job"]) => listRuns(job) as Promise<PoliticianImport[]>;

const people = () =>
  query<{
    name: string;
    house: string;
    officialId: number | null;
    email: string | null;
    salutation: string;
    toCheck: boolean;
    status: string;
    constituency: string | null;
    party: string;
    country: string | null;
  }>(
    `SELECT n.name, p.house, p.official_id AS "officialId", n.email, n.salutation, n.salutation_to_check AS "toCheck",
       n.status, p.constituency, p.party, p.country
     FROM notable_people n JOIN politicians p ON p.id = n.id WHERE NOT p.is_test ORDER BY n.name`,
  );

const addresses = () =>
  query<{ name: string; address: string }>(
    `SELECT n.name, a.address FROM politician_addresses a JOIN notable_people n ON n.id = a.notable_person_id
     WHERE a.source = 'parliament' ORDER BY n.name, a.address`,
  );

/** An MP as Parliament lists them, with whichever addresses a test gives. */
type Member = Omit<(typeof PARLIAMENT_MEMBERS.Commons.Members.Member)[number], "Addresses"> & {
  Addresses: { Address: object | object[] };
};

/** Parliament lists these MPs, and the fixture's Lords. */
function commonsHas(members: Member[]) {
  server.use(
    http.get(
      "https://data.parliament.uk/membersdataplatform/services/mnis/members/query/:query/Addresses/",
      ({ params }) =>
        String(params.query).startsWith("house=Commons")
          ? HttpResponse.json({ Members: { Member: members } })
          : HttpResponse.json(PARLIAMENT_MEMBERS.Lords),
    ),
  );
}

const [DORA, POLLY, MO] = PARLIAMENT_MEMBERS.Commons.Members.Member;

/** `count` made-up MPs, each in a seat of their own. */
const many = (count: number): Member[] =>
  Array.from({ length: count }, (_, i) => ({
    ...DORA,
    "@Member_Id": String(80000 + i),
    DisplayAs: `Many ${i}`,
    ListAs: `${i}, Many`,
    MemberFrom: "Manchester Rusholme",
    Addresses: { Address: { "@Type_Id": "1", Email: null } },
  })) as Member[];

beforeEach(() => vi.stubEnv("TEST_MP_EMAIL", "test-mp@parliament.example"));
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("importPoliticians", () => {
  useTestDatabase();

  it("fills each body from its list, with salutations, emails and the test MPs, and records each run", async () => {
    for (const body of ["parliament", "scottish-parliament", "senedd", "ni-assembly"] as const) {
      expect((await importPoliticians(body, NIGHTLY)).status).toBe("applied");
    }
    expect(await people()).toEqual([
      expect.objectContaining({
        name: "Aoife Example",
        house: "ni-assembly",
        officialId: 93001,
        salutation: "Ms Example",
      }),
      expect.objectContaining({
        name: "Gwen Example",
        house: "senedd",
        email: "gwen.example-ms@senedd.wales",
        salutation: "Ms Example",
        toCheck: false,
        country: "wales",
      }),
      expect.objectContaining({
        name: "Lord Seedling of Example",
        house: "lords",
        officialId: 90101,
        email: null,
        salutation: "Lord Seedling",
      }),
      expect.objectContaining({ name: "Mo Example", salutation: "Mx Example", email: "mp90003.office@parliament.uk" }),
      expect.objectContaining({ name: "Morag Example", constituency: "Exampleshire North", salutation: "Ms Example" }),
      expect.objectContaining({ name: "Ms Dora Dummy", officialId: 90001, country: "england", party: "Labour" }),
      expect.objectContaining({ name: "Polly Placeholder", email: "polly.placeholder.mp@parliament.uk" }),
    ]);
    // Never the Lords' shared inbox, which the constraint would refuse anyway.
    expect((await addresses()).map((a) => a.address)).not.toContain("contactholmember@parliament.uk");
    expect(await query("SELECT domain FROM politician_domains ORDER BY domain")).toEqual([
      { domain: "parliament.example" },
      { domain: "polly.example" },
    ]);
    expect(await query("SELECT count(*)::int AS n FROM politicians WHERE is_test")).toEqual([{ n: 5 }]);
    const [run] = await runs("import-parliament");
    expect(run).toMatchObject({ status: "applied", startedBy: NIGHTLY });
    expect(run.result.changes.added).toHaveLength(4);
    expect(run.result.relinked).toEqual({ read: 0, unread: 0, linked: 0, unlinked: 0, offices: 0 });
    // Every constituency but the fixture's three has no MP.
    expect(run.result.vacant).toHaveLength(647);
    expect((await importPoliticians("parliament", JO)).status).toBe("unchanged");
  });

  it("links the politicians we have by name, keeping their emails, and lists salutations unlike the rule's once", async () => {
    await addTestPolitician({ name: "Polly Placeholder", salutation: "Polly", email: "polly@example.org" });
    await addTestPolitician({ name: "Dora Dummy", salutation: "Ms Dummy", email: null, airtableId: "recDummy" });
    const { result } = await importPoliticians("parliament", JO);
    expect(result.changes.salutations).toEqual([
      expect.objectContaining({ name: "Polly Placeholder", ours: "Polly", rule: "Ms Placeholder" }),
    ]);
    const polly = (await people()).find((p) => p.name === "Polly Placeholder")!;
    expect(polly).toMatchObject({ officialId: 90002, email: "polly@example.org", salutation: "Polly" });
    expect((await addresses()).filter((a) => a.name === "Polly Placeholder")).toEqual([
      { name: "Polly Placeholder", address: "polly.placeholder.mp@parliament.uk" },
    ]);
    // Dora, matched by name without her title, takes the address her body lists, as we had none.
    expect((await people()).find((p) => p.officialId === 90001)).toMatchObject({
      email: "mp90001.office@parliament.uk",
    });
    expect((await importPoliticians("parliament", JO)).result.changes.salutations).toEqual([]);
  });

  it("moves to the body's new address once it stops listing ours, keeping the old one as theirs", async () => {
    await importPoliticians("parliament", JO);
    commonsHas([{ ...POLLY, Addresses: { Address: { "@Type_Id": "1", Email: "polly.new@parliament.uk" } } }, DORA, MO]);
    await importPoliticians("parliament", JO);
    expect((await people()).find((p) => p.name === "Polly Placeholder")!.email).toBe("polly.new@parliament.uk");
    expect((await addresses()).filter((a) => a.name === "Polly Placeholder").map((a) => a.address)).toEqual([
      "polly.new@parliament.uk",
      "polly.placeholder.mp@parliament.uk",
    ]);
  });

  it("marks who left, with why and when from Parliament, and logs it", async () => {
    await importPoliticians("parliament", JO);
    commonsHas([POLLY, MO]);
    const { status, result } = await importPoliticians("parliament", JO);
    expect(status).toBe("applied");
    expect(result.changes.left).toEqual([
      expect.objectContaining({ name: "Ms Dora Dummy", status: "retired", date: "2026-10-01", reason: "Retirement" }),
    ]);
    expect((await people()).find((p) => p.name === "Ms Dora Dummy")!.status).toBe("retired");
    const [logged] = await query<{ details: object }>(
      "SELECT details FROM audit_log WHERE action = 'edit politician' AND details->'changed' ? 'status'",
    );
    expect(logged.details).toMatchObject({
      date: "2026-10-01",
      note: "Retirement",
      changed: { status: ["in_office", "retired"] },
    });
    expect(result.vacant).toContain("Hackney North and Stoke Newington");
  });

  it("gives an address two members list to neither", async () => {
    commonsHas([
      { ...DORA, Addresses: { Address: { "@Type_Id": "1", Email: "shared@parliament.uk" } } },
      { ...POLLY, Addresses: { Address: { "@Type_Id": "1", Email: "shared@parliament.uk" } } },
    ]);
    await importPoliticians("parliament", JO);
    expect((await addresses()).map((a) => a.address)).not.toContain("shared@parliament.uk");
    expect((await people()).find((p) => p.name === "Polly Placeholder")!.email).toBeNull();
  });

  it("holds a run that would change too much, emails once, and applies or discards it when staff say", async () => {
    await importPoliticians("parliament", JO);
    commonsHas([DORA, POLLY, MO, ...many(21)]);
    const sent = notifications();
    const held = await importPoliticians("parliament", NIGHTLY);
    expect(held.status).toBe("held");
    expect(held.result.members).toHaveLength(25);
    expect((await people()).filter((p) => p.name.startsWith("Many"))).toEqual([]);
    expect((await importPoliticians("parliament", NIGHTLY)).status).toBe("held");
    const title = politiciansCopy.politicianImports.titles["import-parliament"];
    expect(sent.filter((n) => n.Subject === politiciansCopy.notifications.importHeld.subject(title, 21))).toHaveLength(
      1,
    );
    // The newer run replaced the older, which can no longer be applied.
    const [newest, oldest] = await runs("import-parliament");
    expect(await decideHeldImport(oldest.id, "apply", JO)).toBe(false);
    expect(await decideHeldImport(newest.id, "apply", JO)).toBe(true);
    expect(await decideHeldImport(newest.id, "apply", JO)).toBe(false);
    expect((await people()).filter((p) => p.name.startsWith("Many"))).toHaveLength(21);
    expect((await runs("import-parliament")).map((r) => [r.status, r.decidedBy])).toEqual([
      ["applied", JO],
      ["discarded", NEWER_RUN],
      ["applied", null],
    ]);
  });

  it("discards a held run when a newer one isn't held, as its list is out of date", async () => {
    await importPoliticians("parliament", JO);
    commonsHas([DORA, POLLY, MO, ...many(21)]);
    await importPoliticians("parliament", NIGHTLY);
    commonsHas([DORA, POLLY, MO]);
    expect((await importPoliticians("parliament", NIGHTLY)).status).toBe("unchanged");
    expect((await runs("import-parliament")).map((r) => [r.status, r.decidedBy])).toEqual([
      ["unchanged", null],
      ["discarded", NEWER_RUN],
      ["applied", null],
    ]);
  });

  it("holds a run that renames someone, or gives an MP a seat no postcode finds", async () => {
    await importPoliticians("parliament", JO);
    commonsHas([{ ...DORA, DisplayAs: "Someone Else" }, POLLY, MO]);
    expect((await importPoliticians("parliament", JO)).result.changes.renamed).toEqual([
      expect.objectContaining({ from: "Ms Dora Dummy", to: "Someone Else" }),
    ]);
    commonsHas([{ ...DORA, MemberFrom: "Hackney North & Stoke Newington" }, POLLY, MO]);
    const { status, result } = await importPoliticians("parliament", JO);
    expect(status).toBe("held");
    expect(result.changes.unofficial).toEqual([
      { name: "Ms Dora Dummy", constituency: "Hackney North & Stoke Newington" },
    ]);
  });

  it("reports two MPs in office for one seat, as a postcode there finds the wrong one", async () => {
    commonsHas([DORA, { ...POLLY, MemberFrom: DORA.MemberFrom }]);
    await importPoliticians("parliament", JO);
    const [run] = await runs("import-parliament");
    expect(run.problems).toEqual([
      expect.objectContaining({
        what: politiciansCopy.politicianImports.twoMps,
        error: "Hackney North and Stoke Newington",
      }),
    ]);
  });

  it("leaves a new member's salutation as their name, to check, when Wikidata can't be asked, and makes it next time", async () => {
    server.use(http.post("https://query.wikidata.org/sparql", () => new HttpResponse("down", { status: 503 })));
    await importPoliticians("senedd", JO);
    expect((await people())[0]).toMatchObject({ name: "Gwen Example", salutation: "Gwen Example", toCheck: true });
    const [run] = await runs("import-senedd");
    expect(run.problems).toEqual([
      expect.objectContaining({ what: politiciansCopy.politicianImports.genderLookupFailed }),
    ]);
    server.resetHandlers();
    await importPoliticians("senedd", JO);
    expect((await people())[0]).toMatchObject({ salutation: "Ms Example", toCheck: false });
  });

  it("asks Wikidata only about members who need a salutation, making a surname from the name when it has none", async () => {
    await importPoliticians("senedd", JO);
    let asked = 0;
    server.use(
      http.post("https://query.wikidata.org/sparql", () => {
        asked++;
        return HttpResponse.json({
          results: {
            bindings: [{ id: { value: "92002" }, gender: { value: "http://www.wikidata.org/entity/Q6581097" } }],
          },
        });
      }),
    );
    expect((await importPoliticians("senedd", JO)).status).toBe("unchanged");
    expect(asked).toBe(0);
    const member = (id: number, name: string) =>
      `<councillor><councillorid>${id}</councillorid><fullusername>${name} MS</fullusername></councillor>`;
    server.use(
      http.get("https://business.senedd.wales/mgwebservice.asmx/GetCouncillorsByWard", () =>
        HttpResponse.text(
          `<wards><ward><wardtitle>Ynys Môn</wardtitle>${member(92002, "Rhun ap Iorwerth")}${member(92003, "Sam Unknown")}</ward></wards>`,
        ),
      ),
    );
    const { result } = await importPoliticians("senedd", JO);
    expect(asked).toBe(1);
    expect(result.changes.left).toEqual([
      expect.objectContaining({ name: "Gwen Example", status: "left_office", reason: null }),
    ]);
    expect((await people()).map((p) => [p.name, p.salutation, p.toCheck, p.status])).toEqual([
      ["Gwen Example", "Ms Example", false, "left_office"],
      ["Rhun ap Iorwerth", "Mr ap Iorwerth", false, "in_office"],
      ["Sam Unknown", "Sam Unknown", true, "in_office"],
    ]);
    const [logged] = await query<{ details: { note: string } }>(
      "SELECT details FROM audit_log WHERE action = 'edit politician' AND details->>'name' = 'Gwen Example'",
    );
    expect(logged.details.note).toBe("");
  });

  it("uses Wikidata's surname only where the member's name ends with it", async () => {
    const female = { value: "http://www.wikidata.org/entity/Q6581072" };
    server.use(
      http.post("https://query.wikidata.org/sparql", () =>
        HttpResponse.json({
          results: {
            bindings: [
              { id: { value: "92004" }, gender: female, surname: { value: "Cooper" } },
              { id: { value: "92005" }, gender: female, surname: { value: "Long Bailey" } },
            ],
          },
        }),
      ),
      http.get("https://business.senedd.wales/mgwebservice.asmx/GetCouncillorsByWard", () =>
        HttpResponse.text(
          `<wards><ward><wardtitle>Ynys Môn</wardtitle>` +
            `<councillor><councillorid>92004</councillorid><fullusername>Sarah Cooper-Lesadd MS</fullusername></councillor>` +
            `<councillor><councillorid>92005</councillorid><fullusername>Jane Long Bailey MS</fullusername></councillor>` +
            `</ward></wards>`,
        ),
      ),
    );
    await importPoliticians("senedd", JO);
    expect((await people()).map((p) => [p.name, p.salutation])).toEqual([
      ["Jane Long Bailey", "Ms Long Bailey"],
      ["Sarah Cooper-Lesadd", "Ms Cooper-Lesadd"],
    ]);
  });

  it("takes the salutation a title Parliament records makes over ours, but keeps one staff set, as a problem", async () => {
    await importPoliticians("parliament", JO);
    const [dora, mo] = await query<{ id: number }>(
      "SELECT id::int AS id FROM notable_people WHERE name IN ('Ms Dora Dummy', 'Mo Example') ORDER BY name DESC",
    );
    // Dora's salutation is wrong, and the import's own change of it isn't staff's; Mo's, staff set.
    await query("UPDATE notable_people SET salutation = 'Mrs Dummy' WHERE id = $1", [dora.id]);
    await query(`INSERT INTO audit_log (actor, action, details) VALUES ('import-parliament', 'edit politician', $1)`, [
      { id: dora.id, name: "Ms Dora Dummy", changed: { salutation: ["Ms Dummy", "Mrs Dummy"] } },
    ]);
    await editPoliticianDetails(mo.id, { salutation: "Mo" }, JO);
    const sent = notifications();
    const { result } = await importPoliticians("parliament", NIGHTLY);
    expect(result.changes.changed).toEqual([
      expect.objectContaining({ name: "Ms Dora Dummy", changed: { salutation: ["Mrs Dummy", "Ms Dummy"] } }),
    ]);
    expect((await people()).map((p) => [p.name, p.salutation])).toEqual(
      expect.arrayContaining([
        ["Ms Dora Dummy", "Ms Dummy"],
        ["Mo Example", "Mo"],
      ]),
    );
    const kept = politiciansCopy.politicianImports.keptSalutation("Mo Example", "Mo", "parliament", "Mx Example");
    expect(kept).toBe("Mo Example: staff set Mo; Parliament records Mx Example");
    await importPoliticians("parliament", NIGHTLY);
    const [newest, before] = await runs("import-parliament");
    expect([newest.problems, before.problems]).toEqual([[{ what: kept }], [{ what: kept }]]);
    // Staff are emailed about it once, not each night it stays.
    const title = politiciansCopy.politicianImports.titles["import-parliament"];
    expect(sent.filter((n) => n.Subject === importRunsCopy.notifications.importProblems.subject(title))).toHaveLength(
      1,
    );
  });

  it("adds the test MPs with no email when TEST_MP_EMAIL isn't set", async () => {
    vi.stubEnv("TEST_MP_EMAIL", "");
    await importPoliticians("parliament", JO);
    const emails = await query<{ email: string | null }>(
      "SELECT n.email FROM notable_people n JOIN politicians p ON p.id = n.id WHERE p.is_test ORDER BY n.email",
    );
    expect(emails.filter((row) => row.email === null).length).toBeGreaterThan(1);
  });

  it("knows which jobs are a body's import", () => {
    expect(isPoliticianImport("import-senedd")).toBe(true);
    expect(isPoliticianImport("sync-politicians")).toBe(false);
  });
});
