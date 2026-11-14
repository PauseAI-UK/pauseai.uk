import { expect, it } from "vitest";
import {
  addAuditEntry,
  addTestLetter,
  addTestPolitician,
  describeWithDatabase,
  useTestDatabase,
} from "@/tests/database";
import { addTestMessage as message, addTestReply as reply, addTestThread as thread } from "@/tests/correspondence";
import { AUTO_REPLY_PATTERN, isMachineReply } from "@/lib/email-parsing/subjects";
import type { ThreadMessages } from "./threads";
import { query } from "@/lib/server/db";
import { politicianMessages } from "./correspondence";
import { getPolitician, listPoliticians } from "./records";

const POLLY = "polly.placeholder.mp@parliament.uk";

/** The emails each way that a politician's threads show, as their page has them: its one-off messages, and the replies to its letters. */
function shown(held: ThreadMessages) {
  const oneOffs = Object.values(held.oneOffs).flat();
  const all = [...Object.values(held.letters).flat(), ...oneOffs];
  return {
    toThem: oneOffs.filter((step) => step.who !== "them").length,
    fromThem: all.filter((step) => step.who === "them" && !step.auto).length,
  };
}

describeWithDatabase("the emails to and from a politician", () => {
  useTestDatabase();

  const counts = async (id: number) => {
    const { emailsToThem, emailsFromThem } = (await getPolitician(id))!;
    return { emailsToThem, emailsFromThem };
  };

  it("counts as emails to them only the letters that went", async () => {
    const polly = await addTestPolitician();
    await addTestLetter({ politicianId: polly });
    await addTestLetter({ politicianId: polly, status: "bounced" });
    await addTestLetter({ politicianId: polly, status: "not_sent" });
    // A mailing's letters that never went: one stopped, one skipped, one still to go.
    await query(
      "INSERT INTO letters (kind, notable_person_id, status) VALUES ('pauseai', $1, 'cancelled'), ('pauseai', $1, 'skipped'), ('pauseai', $1, 'scheduled')",
      [polly],
    );
    expect(await counts(polly)).toEqual({ emailsToThem: 2, emailsFromThem: 0 });
  });

  it("counts as emails from them the replies to a letter that aren't ours, the supporter's or automatic", async () => {
    const polly = await addTestPolitician();
    // A letter marked answered with no reply kept counts none: only the messages kept are counted.
    const letter = await addTestLetter({ politicianId: polly, repliedAt: "2026-10-01T09:00:00Z" });
    expect(await counts(polly)).toEqual({ emailsToThem: 1, emailsFromThem: 0 });
    await reply(letter, "ours", { from: "policy@pauseai.uk", us: true });
    await reply(letter, "own", { from: "jane@example.com", supporter: true });
    await reply(letter, "real", { from: POLLY });
    // A reply is theirs whoever's address it's from.
    await reply(letter, "elsewhere", { from: "aide@example.org" });
    await reply(letter, "machine", { from: POLLY });
    await query(
      `INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'auto_reply', '{"gmailMessageId": "machine"}')`,
      [letter],
    );
    expect(await counts(polly)).toEqual({ emailsToThem: 1, emailsFromThem: 2 });
  });

  it("counts a one-off message of ours from a parliament's address neither way", async () => {
    const polly = await addTestPolitician();
    const id = await thread([polly], "Coffee?", false);
    await message(id, "ours", "pauseai@parliament.uk", { us: true });
    expect(await counts(polly)).toEqual({ emailsToThem: 0, emailsFromThem: 0 });
  });

  it("gives the list and their page the numbers their page's threads show, whoever's address a message is from", async () => {
    const polly = await addTestPolitician();
    const peer = await addTestPolitician({
      name: "Lord Example",
      house: "lords",
      constituency: null,
      airtableId: "recLord",
      email: "lord.example@example.org",
    });
    const nora = await addTestPolitician({ name: "Nora Nothing", airtableId: "recNora", email: null });
    await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source, added_by) VALUES
         ('polly@home.example', $1, 'staff', 'jo@pauseai.uk'), ('aide@casework.example', $1, 'office', NULL),
         ('wrong@elsewhere.example', $1, 'rejected', 'jo@pauseai.uk'),
         ('shared@office.example', $1, 'office', NULL), ('shared@office.example', $2, 'office', NULL),
         ('lord@pollyplaceholder.example', $2, 'staff', 'jo@pauseai.uk')`,
      [polly, peer],
    );
    await query("INSERT INTO politician_domains (domain, notable_person_id) VALUES ('pollyplaceholder.example', $1)", [
      polly,
    ]);
    await addAuditEntry("sync", "edit politician", {
      id: polly,
      changed: { email: ["old.polly@past.example", POLLY] },
    });
    // An edit that names no one puts its address in the book as nobody's.
    await addAuditEntry("sync", "edit politician", { changed: { email: [null, "ghost@pollyplaceholder.example"] } });

    const letter = await addTestLetter({ politicianId: polly });
    await addTestLetter({ politicianId: polly, status: "bounced" });
    await addTestLetter({ politicianId: polly, status: "not_sent" });
    await addTestLetter({ politicianId: peer });
    await reply(letter, "ours", { from: "policy@pauseai.uk", us: true });
    await reply(letter, "own", { from: "jane@example.com", supporter: true });
    await reply(letter, "real", { from: POLLY });
    await reply(letter, "elsewhere", { from: "aide@example.org" });
    await reply(letter, "auto", { from: POLLY });
    await query(
      `INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'auto_reply', '{"gmailMessageId": "auto"}')`,
      [letter],
    );

    // One thread with both on it, and someone else, so each address is weighed for each of them. After each, whose
    // office it counts as from: both, one, or neither.
    const id = await thread([polly, peer], "Coffee?", true);
    await message(id, "us", "policy@pauseai.uk", { us: true }); // neither
    await message(id, "own", POLLY); // both: any parliament's address is
    await message(id, "clerk", "clerk@parliament.uk"); // both
    await message(id, "under", "aide@members.parliament.scot"); // both: under a parliament's domain
    await message(id, "two", "odd@example.com@senedd.wales"); // both: the domain follows the last @
    await message(id, "alike", "aide@notparliament.uk"); // neither: only ends like one
    await message(id, "bare", "undisclosed"); // neither: no domain at all
    await message(id, "home", "polly@home.example"); // Polly: staff added it
    await message(id, "aide", "aide@casework.example"); // Polly: her office's
    await message(id, "wrong", "wrong@elsewhere.example"); // neither: staff rejected it
    await message(id, "past", "old.polly@past.example"); // Polly: hers before an edit
    await message(id, "domain", "team@pollyplaceholder.example"); // Polly: on her own domain
    await message(id, "shared", "shared@office.example"); // both: an office they share
    await message(id, "known", "lord@pollyplaceholder.example"); // the peer: his address, though on her domain
    await message(id, "ghost", "ghost@pollyplaceholder.example"); // neither: in the book as nobody's, though on her domain
    await message(id, "peer", "lord.example@example.org"); // the peer
    await message(id, "machine", POLLY, { subject: "Automatic reply: Coffee?" }); // an office's, but a machine's
    await message(id, "away", "vera@example.com", { subject: "Out of office" }); // neither

    expect(await counts(polly)).toEqual({ emailsToThem: 2 + 8, emailsFromThem: 2 + 9 });
    expect(await counts(peer)).toEqual({ emailsToThem: 1 + 10, emailsFromThem: 7 });
    expect(await counts(nora)).toEqual({ emailsToThem: 0, emailsFromThem: 0 });

    // The list has what each one's page has, and both what the page's threads show: the same for a reader the
    // thread is hidden from, who's given the counts alone.
    const listed = await listPoliticians({});
    expect(listed.map((one) => one.id).sort()).toEqual([polly, peer, nora].sort());
    const letters: Record<number, number> = { [polly]: 2, [peer]: 1 };
    for (const one of listed) {
      expect(await getPolitician(one.id)).toEqual(one);
      const { toThem, fromThem } = shown(await politicianMessages(one.id, ["supporters"]));
      expect([one.emailsToThem, one.emailsFromThem], one.name).toEqual([(letters[one.id] ?? 0) + toThem, fromThem]);
    }
    expect((await politicianMessages(polly, [])).oneOffs).toEqual({});

    // Each heading's sort, by the name the list's URL has for it: the peer has had more, and Polly has sent more.
    const sorted = async (key: "emailsToThem" | "emailsFromThem", dir: "asc" | "desc") =>
      (await listPoliticians({ sort: { key, dir } })).map((one) => one.id);
    expect(await sorted("emailsToThem", "desc")).toEqual([peer, polly, nora]);
    expect(await sorted("emailsFromThem", "desc")).toEqual([polly, peer, nora]);
    expect(await sorted("emailsFromThem", "asc")).toEqual([nora, peer, polly]);
  });

  it("dates a politician's first and last activity by the one-off messages it counts, with their letters and answers", async () => {
    // Nora's only contact is a one-off thread.
    const nora = await addTestPolitician({ name: "Nora Nothing", airtableId: "recNora", email: "nora@example.org" });
    const hers = await thread([nora], "Coffee?", false);
    await message(hers, "ours", "policy@pauseai.uk", { us: true, at: "2026-03-01T09:00:00Z" });
    await message(hers, "reply", "nora@example.org", { at: "2026-03-05T09:00:00Z" });
    // Neither of these counts as an email either way, so neither is activity: her office's automatic reply, and
    // one of ours from a parliament's address.
    await message(hers, "away", "nora@example.org", { subject: "Out of office", at: "2026-03-09T09:00:00Z" });
    await message(hers, "odd", "pauseai@parliament.uk", { us: true, at: "2026-01-01T09:00:00Z" });
    expect(await getPolitician(nora)).toMatchObject({
      emailsToThem: 1,
      emailsFromThem: 1,
      firstActivityAt: new Date("2026-03-01T09:00:00Z"),
      lastActivityAt: new Date("2026-03-05T09:00:00Z"),
    });

    // Polly has a letter between two one-off messages; the peer a letter alone; Rita nothing.
    const polly = await addTestPolitician();
    await addTestLetter({ politicianId: polly, createdAt: "2026-02-01T09:00:00Z" });
    const pollys = await thread([polly], "Hello", false);
    await message(pollys, "early", "vera@example.com", { at: "2026-01-15T09:00:00Z" });
    await message(pollys, "late", POLLY, { at: "2026-04-01T09:00:00Z" });
    const peer = await addTestPolitician({ name: "Lord Example", house: "lords", airtableId: "recLord", email: null });
    await addTestLetter({ politicianId: peer, createdAt: "2026-02-10T09:00:00Z" });
    const rita = await addTestPolitician({ name: "Rita Retired", airtableId: "recRita", email: null });
    expect(await getPolitician(polly)).toMatchObject({
      firstActivityAt: new Date("2026-01-15T09:00:00Z"),
      lastActivityAt: new Date("2026-04-01T09:00:00Z"),
    });
    expect(await getPolitician(peer)).toMatchObject({
      firstActivityAt: new Date("2026-02-10T09:00:00Z"),
      lastActivityAt: new Date("2026-02-10T09:00:00Z"),
    });
    expect(await getPolitician(rita)).toMatchObject({ firstActivityAt: null, lastActivityAt: null });

    // The list has the same dates, and sorts by them, those with none last.
    const sorted = async (key: "first" | "active", dir: "asc" | "desc") =>
      (await listPoliticians({ sort: { key, dir } })).map((one) => one.id);
    expect(await sorted("active", "desc")).toEqual([polly, nora, peer, rita]);
    expect(await sorted("first", "asc")).toEqual([polly, peer, nora, rita]);
    for (const one of await listPoliticians({})) expect(await getPolitician(one.id)).toEqual(one);
  });

  it("reads a machine's subject in SQL as isMachineReply does", async () => {
    const machine = (subject: string) => isMachineReply(() => undefined, subject);
    const subjects = [
      "Automatic reply: Hi",
      "AUTO-REPLY",
      "auto reply",
      "Auto response",
      "autoresponse.",
      "Out of the office",
      "\n\t Out of Office: Hi",
      "Re: Automatic reply",
      "Automatic replies",
      "Autoreplying",
      "auto  reply",
      "Out of offices",
      "",
    ];
    const read = await query<{ subject: string; machine: boolean }>(
      `SELECT subject, subject ~* '${AUTO_REPLY_PATTERN}' AS machine FROM unnest($1::text[]) subject`,
      [subjects],
    );
    expect(read).toEqual(subjects.map((subject) => ({ subject, machine: machine(subject) })));
    expect(read.filter((one) => one.machine)).toHaveLength(7);

    // Every character there is in two bytes of UTF-16, before the words and after them: which count as white space,
    // and which carry the last word on.
    const [{ before, after }] = await query<{ before: number[]; after: number[] }>(
      `SELECT array_agg(code ORDER BY code) FILTER (WHERE (chr(code) || 'auto reply') ~* '${AUTO_REPLY_PATTERN}') AS before,
         array_agg(code ORDER BY code) FILTER (WHERE ('auto reply' || chr(code)) ~* '${AUTO_REPLY_PATTERN}') AS after
       FROM generate_series(1, 65535) code WHERE code NOT BETWEEN 55296 AND 57343`,
    );
    const codes = [...Array(65535).keys()].map((i) => i + 1).filter((code) => code < 0xd800 || code > 0xdfff);
    expect(before).toEqual(codes.filter((code) => machine(`${String.fromCharCode(code)}auto reply`)));
    expect(after).toEqual(codes.filter((code) => machine(`auto reply${String.fromCharCode(code)}`)));
  });
});
