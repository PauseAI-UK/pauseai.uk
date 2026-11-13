import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { addTestPolitician, connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { stubLettersInboxEnv } from "@/tests/gmail-sends";
import { addressForms } from "@/lib/one-off";
import { query } from "./db";
import {
  addPoliticianAddress,
  formExamples,
  politicianAliases,
  removePoliticianAddress,
  searchAddedAddresses,
} from "./politician-aliases";
import { staffCopy } from "@/lib/content/staff-interface";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

it("gives the address forms a politician's name and seat make, in their house's style, if theirs alone", () => {
  const people = [
    { id: 1, name: "Dame Meg Hillier", house: "commons", constituency: "Hackney South", inOffice: true },
    { id: 2, name: "Kate Forbes", house: "scottish-parliament", constituency: null, inOffice: true },
    { id: 3, name: "Luke Fletcher", house: "senedd", constituency: null, inOffice: true },
    { id: 4, name: "Jo Bloggs", house: "ni-assembly", constituency: null, inOffice: true },
    { id: 5, name: "Baroness Chakrabarti", house: "lords", constituency: null, inOffice: true },
    { id: 6, name: "Meg Hillier", house: "other", constituency: null, inOffice: false },
  ];
  const book = { addresses: new Map(), domains: new Map(), forms: addressForms(people) };
  expect(formExamples(book, people[0])).toEqual(["hackneysouth.mp@parliament.uk"]);
  expect(formExamples(book, { ...people[0], constituency: null })).toEqual([]);
  expect(formExamples(book, people[1])).toEqual(["kate.forbes.msp@parliament.scot"]);
  expect(formExamples(book, { ...people[1], constituency: "Skye" })).toEqual(["kate.forbes.msp@parliament.scot"]);
  expect(formExamples(book, people[2])).toEqual(["luke.fletcher@senedd.wales"]);
  expect(formExamples(book, people[3])).toEqual(["jo.bloggs@mla.niassembly.gov.uk"]);
  expect(formExamples(book, people[4])).toEqual([]);
  expect(formExamples(book, { ...people[0], name: "Hillier" })).toEqual(["hackneysouth.mp@parliament.uk"]);
  expect(formExamples(book, people[5])).toEqual([]);
});

describeWithDatabase("a politician's aliases", () => {
  useTestDatabase();
  beforeEach(() => stubLettersInboxEnv());
  afterEach(() => vi.unstubAllEnvs());

  const politician = async () => {
    const id = await addTestPolitician();
    return { id, name: "Polly Placeholder", house: "commons", constituency: "Cities of London and Westminster" };
  };

  it("lists each address and domain by where it came from, leaving out their email where it's repeated", async () => {
    const polly = await politician();
    await query(
      `INSERT INTO audit_log (actor, action, details) VALUES ('sync', 'edit politician', $1), ('sync', 'edit politician', $2)`,
      [
        JSON.stringify({
          id: polly.id,
          changed: { email: ["old.polly@example.com", "polly.placeholder.mp@parliament.uk"] },
        }),
        JSON.stringify({ id: polly.id, changed: { name: ["Polly", "Polly Placeholder"] } }),
      ],
    );
    await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source, added_by) VALUES
       ('polly.placeholder.mp@parliament.uk', $1, 'parliament', NULL), ('placeholderp@parliament.uk', $1, 'parliament', NULL),
       ('jane.smith@parliament.uk', $1, 'office', NULL), ('polly@example.com', $1, 'staff', 'jo@pauseai.uk'),
       ('citiesoflondonandwestminster.mp@parliament.uk', $1, 'rejected', 'jo@pauseai.uk')`,
      [polly.id],
    );
    await query("INSERT INTO politician_domains (domain, notable_person_id) VALUES ('polly.example', $1)", [polly.id]);
    expect(await politicianAliases({ ...polly, email: "Polly.Placeholder.MP@parliament.uk" })).toEqual({
      email: "Polly.Placeholder.MP@parliament.uk",
      past: ["old.polly@example.com"],
      parliament: ["placeholderp@parliament.uk"],
      office: ["jane.smith@parliament.uk"],
      added: [{ address: "polly@example.com", addedBy: "jo@pauseai.uk", at: expect.any(Date) }],
      domains: ["polly.example"],
      forms: ["citiesoflondonandwestminster.mp@parliament.uk"],
    });
    expect((await politicianAliases({ ...polly, email: null })).parliament).toHaveLength(2);
  });

  /** The fake Gmail for policy@: searches find m1, from Polly's Gmail, one gone, and m2, from nobody; `refuse` answers a fetch of m2 as past the limit. */
  function mailbox(searched: string[], refuse: "quota" | "error" | null = null) {
    server.use(
      http.get(`${GMAIL}/messages`, ({ request }) => {
        searched.push(new URL(request.url).searchParams.get("q")!);
        return HttpResponse.json({ messages: [{ id: "m1" }, { id: "gone" }, { id: "m2" }] });
      }),
      http.get(`${GMAIL}/messages/gone`, () => new HttpResponse("{}", { status: 404 })),
      http.get(`${GMAIL}/messages/:id`, ({ request, params }) => {
        if (refuse && params.id === "m2")
          return refuse === "quota"
            ? HttpResponse.json({ error: { message: "Quota exceeded for quota metric" } }, { status: 403 })
            : HttpResponse.json({ error: { message: "Broken" } }, { status: 500 });
        const from = params.id === "m1" ? "Polly <polly.personal@example.com>" : "Nobody <nobody@example.com>";
        const headers = [
          { name: "From", value: from },
          { name: "To", value: "policy@pauseai.uk" },
          { name: "Subject", value: "Hello" },
          { name: "Message-ID", value: `<${String(params.id)}@example.org>` },
        ];
        const base = {
          id: params.id,
          threadId: `t-${String(params.id)}`,
          labelIds: ["INBOX"],
          internalDate: "1790000000000",
        };
        if (new URL(request.url).searchParams.get("format") === "raw") {
          const raw = `${headers.map((h) => `${h.name}: ${h.value}`).join("\r\n")}\r\n\r\nHi`;
          return HttpResponse.json({ ...base, raw: Buffer.from(raw).toString("base64url") });
        }
        return HttpResponse.json({ ...base, payload: { headers } });
      }),
      http.get(`${GMAIL}/threads/:id`, ({ params }) =>
        HttpResponse.json({ messages: [{ id: String(params.id).slice(2) }] }),
      ),
    );
  }

  const LATER = () => Date.now() + 60_000;
  const searchedAt = () => query<{ at: Date | null }>("SELECT searched_at AS at FROM politician_addresses");

  it("adds an address by hand, logged, linking what's kept with it, and leaves the search for later", async () => {
    const polly = await politician();
    const [{ id: thread }] = await query<{ id: number }>(
      "INSERT INTO one_off_threads (latest_at) VALUES (now()) RETURNING id::int AS id",
    );
    await query(
      `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, from_address, addresses, at,
         from_us, blob_key, size, quoted_addresses, quoted_names)
       VALUES ($1, 'policy@pauseai.uk', 'g', 't', 'polly.personal@example.com', '{polly.personal@example.com}', now(),
         false, 'x', 1, '{}', '{}')`,
      [thread],
    );
    expect(await addPoliticianAddress(polly.id, " Polly.Personal@Example.com ", "jo@pauseai.uk")).toEqual({
      added: true,
    });
    expect(await query("SELECT notable_person_id::int AS id FROM one_off_thread_people")).toEqual([{ id: polly.id }]);
    expect(await searchedAt()).toEqual([{ at: null }]);
    expect(await query("SELECT actor, details FROM audit_log WHERE action = 'add politician address'")).toEqual([
      { actor: "jo@pauseai.uk", details: { politicianId: polly.id, address: "polly.personal@example.com" } },
    ]);
    expect(await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk")).toEqual({
      added: false,
      why: "exists",
    });
  });

  it("searches the kept mailboxes for each added address once, keeping its earlier mail", async () => {
    const polly = await politician();
    await connectTestGmail("policy@pauseai.uk");
    await connectTestGmail("jo@pauseai.uk");
    vi.stubEnv("POLICY_INBOX", "policy@pauseai.uk");
    const searched: string[] = [];
    mailbox(searched);
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 0, kept: 0, waiting: 0 });
    await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 1, kept: 1, waiting: 0 });
    expect(searched).toEqual(['"polly.personal@example.com"']);
    expect(await query("SELECT notable_person_id::int AS id FROM one_off_thread_people")).toEqual([{ id: polly.id }]);
    expect((await searchedAt())[0].at).toBeInstanceOf(Date);
    // Searched once; added again, it's searched again, passing over what's kept.
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 0, kept: 0, waiting: 0 });
    await removePoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 1, kept: 0, waiting: 0 });
  });

  it("passes over what another mailbox gave us, by its headers, without fetching it whole", async () => {
    const polly = await politician();
    await connectTestGmail("joseph@pauseai.uk");
    const searched: string[] = [];
    mailbox(searched);
    const [{ id: thread }] = await query<{ id: number }>(
      "INSERT INTO one_off_threads (latest_at) VALUES (now()) RETURNING id::int AS id",
    );
    await query(
      `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address,
         addresses, at, from_us, blob_key, size, quoted_addresses, quoted_names)
       VALUES ($1, 'policy@pauseai.uk', 'p1', 'pt', 'm1@example.org', 'polly.personal@example.com', '{}', now(), false, 'k', 1, '{}', '{}')`,
      [thread],
    );
    // Fetching m1 whole, or its thread, would fail the search.
    server.use(
      http.get(`${GMAIL}/messages/m1`, ({ request }) =>
        new URL(request.url).searchParams.get("format") === "raw"
          ? new HttpResponse("{}", { status: 500 })
          : HttpResponse.json({
              id: "m1",
              threadId: "t-m1",
              labelIds: ["INBOX"],
              internalDate: "1790000000000",
              payload: {
                headers: [
                  { name: "From", value: "Polly <polly.personal@example.com>" },
                  { name: "Message-ID", value: "<m1@example.org>" },
                ],
              },
            }),
      ),
    );
    await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    const error = vi.spyOn(console, "error");
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 1, kept: 0, waiting: 0 });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("stops when Gmail refuses for now, as a problem of the run, and carries on next time", async () => {
    const polly = await politician();
    await connectTestGmail("policy@pauseai.uk");
    vi.stubEnv("POLICY_INBOX", "policy@pauseai.uk");
    mailbox([], "quota");
    await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    await addPoliticianAddress(polly.id, "polly.other@example.com", "jo@pauseai.uk");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 0, kept: 1, waiting: 2 });
    expect(error).toHaveBeenCalledWith(
      staffCopy.problems.job.addressNotSearched("polly.personal@example.com"),
      expect.stringContaining("Quota exceeded"),
    );
    error.mockRestore();
    expect(await searchedAt()).toEqual([{ at: null }, { at: null }]);
    mailbox([]);
    expect(await searchAddedAddresses(LATER())).toEqual({ searched: 2, kept: 0, waiting: 0 });
  });

  it("starts on none past its time, and stops partway through one a little after", async () => {
    const polly = await politician();
    await connectTestGmail("policy@pauseai.uk");
    mailbox([]);
    await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    expect(await searchAddedAddresses(Date.now() - 1)).toEqual({
      searched: 0,
      kept: 0,
      waiting: 1,
      stopped: { by: "time" },
    });
    // Started in time, then past the time it may go on to before its first message.
    const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(10_000_000_000_000);
    expect(await searchAddedAddresses(1_000)).toEqual({ searched: 0, kept: 0, waiting: 1, stopped: { by: "time" } });
    now.mockRestore();
    expect(await searchedAt()).toEqual([{ at: null }]);
  });

  it("marks an address searched after another failure, as a problem of the run", async () => {
    const polly = await politician();
    await connectTestGmail("policy@pauseai.uk");
    vi.stubEnv("POLICY_INBOX", "policy@pauseai.uk");
    mailbox([], "error");
    await addPoliticianAddress(polly.id, "polly.personal@example.com", "jo@pauseai.uk");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await searchAddedAddresses(LATER())).toMatchObject({ searched: 1, waiting: 0 });
    expect(error).toHaveBeenCalledWith(
      staffCopy.problems.job.addressNotSearched("polly.personal@example.com"),
      expect.anything(),
    );
    error.mockRestore();
  });

  it("refuses what isn't an email address, or a politician who isn't there", async () => {
    const polly = await politician();
    expect(await addPoliticianAddress(polly.id, "not an address", "jo@pauseai.uk")).toEqual({
      added: false,
      why: "invalid",
    });
    expect(await addPoliticianAddress(polly.id + 99, "a@example.com", "jo@pauseai.uk")).toEqual({
      added: false,
      why: "exists",
    });
    // The Lords' shared inbox is no one's own address.
    expect(await addPoliticianAddress(polly.id, "ContactHOLMember@parliament.uk", "jo@pauseai.uk")).toEqual({
      added: false,
      why: "shared",
    });
  });

  it("removes only an address staff added, logged", async () => {
    const polly = await politician();
    await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source, added_by) VALUES
       ('polly@example.com', $1, 'staff', 'jo@pauseai.uk'), ('listed@parliament.uk', $1, 'parliament', NULL)`,
      [polly.id],
    );
    expect(await removePoliticianAddress(polly.id, "listed@parliament.uk", "jo@pauseai.uk")).toBe(false);
    expect(await removePoliticianAddress(polly.id, " Polly@Example.com", "jo@pauseai.uk")).toBe(true);
    expect(await query("SELECT address FROM politician_addresses")).toEqual([{ address: "listed@parliament.uk" }]);
    expect(await query("SELECT 1 FROM audit_log WHERE action = 'remove politician address'")).toHaveLength(1);
  });

  it("removes a guessed office address for good, unlinking what it alone linked, until staff add it back", async () => {
    const polly = await politician();
    const [{ id: thread }] = await query<{ id: number }>(
      "INSERT INTO one_off_threads (latest_at) VALUES (now()) RETURNING id::int AS id",
    );
    await query(
      `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, from_address, addresses, at,
         from_us, blob_key, size, quoted_addresses, quoted_names)
       VALUES ($1, 'policy@pauseai.uk', 'g', 't', 'aaron.lukas@parliament.uk', '{aaron.lukas@parliament.uk}', now(),
         false, 'x', 1, '{}', '{}')`,
      [thread],
    );
    await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source) VALUES ('aaron.lukas@parliament.uk', $1, 'office')`,
      [polly.id],
    );
    await query("INSERT INTO one_off_thread_people (thread_id, notable_person_id) VALUES ($1, $2)", [thread, polly.id]);
    expect(await removePoliticianAddress(polly.id, "aaron.lukas@parliament.uk", "jo@pauseai.uk")).toBe(true);
    expect(await query("SELECT source, added_by AS by FROM politician_addresses")).toEqual([
      { source: "rejected", by: "jo@pauseai.uk" },
    ]);
    expect(await query("SELECT 1 FROM one_off_thread_people")).toEqual([]);
    expect((await politicianAliases({ ...polly, email: null })).office).toEqual([]);
    expect(await addPoliticianAddress(polly.id, "aaron.lukas@parliament.uk", "jo@pauseai.uk")).toMatchObject({
      added: true,
    });
    expect(await query("SELECT source FROM politician_addresses")).toEqual([{ source: "staff" }]);
    expect(await query("SELECT notable_person_id::int AS id FROM one_off_thread_people")).toEqual([{ id: polly.id }]);
  });
});
