import { expect, it } from "vitest";
import { addTestLetter, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "./db";
import { politicianMessages } from "./politician-correspondence";

const POLLY = "polly.placeholder.mp@parliament.uk";

describeWithDatabase("politicianMessages", () => {
  useTestDatabase();

  async function reply(
    letterId: number,
    id: string,
    fields: { from: string; name?: string; us?: boolean; supporter?: boolean },
  ) {
    await query(
      `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, from_name, at, from_us, from_supporter, blob_key, size)
       VALUES ($1, 'policy@pauseai.uk', $2, 't', $3, $4, '2026-10-01T09:00:00Z', $5, $6, $2, 1)`,
      [letterId, id, fields.from, fields.name ?? "", fields.us ?? false, fields.supporter ?? false],
    );
  }

  async function thread(politician: number, subject: string, someoneElse: boolean) {
    const [{ id }] = await query<{ id: number }>(
      "INSERT INTO one_off_threads (subject, someone_else, latest_at) VALUES ($1, $2, now()) RETURNING id::int AS id",
      [subject, someoneElse],
    );
    await query("INSERT INTO one_off_thread_people (thread_id, notable_person_id) VALUES ($1, $2)", [id, politician]);
    return id;
  }

  async function message(
    thread: number,
    id: string,
    from: string,
    fields: { name?: string; us?: boolean; subject?: string } = {},
  ) {
    await query(
      `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, from_address, from_name, addresses, subject, at, from_us, blob_key, size)
       VALUES ($1, 'policy@pauseai.uk', $2, 't', $3, $4, ARRAY[$3], $5, '2026-10-02T09:00:00Z', $6, $2, 1)`,
      [thread, id, from, fields.name ?? "", fields.subject ?? "A thread", fields.us ?? false],
    );
  }

  it("sorts a letter's messages by who, keeps automatic replies apart, and counts each way", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({ politicianId: polly });
    await reply(letter, "ours", { from: "policy@pauseai.uk", us: true });
    await reply(letter, "own", { from: "jane@example.com", name: "Jane Smith", supporter: true });
    await reply(letter, "real", { from: POLLY, name: "Polly" });
    await reply(letter, "machine", { from: POLLY });
    await query(
      `INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'auto_reply', '{"gmailMessageId": "machine"}')`,
      [letter],
    );
    const held = await politicianMessages(polly, ["supporters"]);
    expect(held.letters[letter].map(({ who, name, auto }) => [who, name, auto])).toEqual([
      ["us", null, false],
      ["supporter", null, false],
      ["them", "Polly", false],
      ["them", null, true],
    ]);
    expect(held.emailsFromThem).toBe(1);
  });

  it("tells their office from anyone else on a one-off thread, and counts only their office", async () => {
    const polly = await addTestPolitician();
    const id = await thread(polly, "Coffee?", true);
    await message(id, "a", "policy@pauseai.uk", { us: true });
    await message(id, "b", POLLY, { name: "Polly" });
    await message(id, "c", "vera@example.com");
    await message(id, "d", POLLY, { subject: "Automatic reply: Coffee?" });
    const held = await politicianMessages(polly, ["supporters"]);
    expect(held.oneOffs[id].map(({ who, name, auto }) => [who, name, auto])).toEqual([
      ["us", null, false],
      ["them", "Polly", false],
      ["other", "vera@example.com", false],
      ["them", POLLY, true],
    ]);
    expect(held).toMatchObject({ emailsToThem: 1, emailsFromThem: 2 });
  });

  it("gives staff without the permission no supporter's message, name or hidden thread, only the counts", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({ politicianId: polly });
    await reply(letter, "own", { from: "jane@example.com", name: "Jane Smith", supporter: true });
    await reply(letter, "office", { from: POLLY, name: "Polly" });
    await reply(letter, "elsewhere", { from: "aide@example.org", name: "An Aide" });
    const hidden = await thread(polly, "Theirs", true);
    await message(hidden, "h", "vera@example.com", { name: "Vera Volunteer" });
    const open = await thread(polly, "Ours", false);
    await message(open, "o", POLLY, { name: "Polly" });
    const held = await politicianMessages(polly, []);
    expect(held.letters[letter].map(({ who, name }) => [who, name])).toEqual([
      ["them", "Polly"],
      ["them", null],
    ]);
    expect(held.oneOffs[hidden]).toBeUndefined();
    expect(held.oneOffs[open]).toHaveLength(1);
    expect(JSON.stringify(held)).not.toMatch(/Jane|Vera|An Aide/);
    expect(held.emailsFromThem).toBe(3);
  });

  it("gives a nameless letter reply no name for those with the permission", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({ politicianId: polly });
    await reply(letter, "office", { from: POLLY });
    expect((await politicianMessages(polly, ["supporters"])).letters[letter][0].name).toBeNull();
  });
});
