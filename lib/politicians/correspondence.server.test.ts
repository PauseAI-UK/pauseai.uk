import { expect, it } from "vitest";
import { addTestLetter, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addTestMessage as message, addTestReply as reply, addTestThread as thread } from "@/tests/correspondence";
import { query } from "@/lib/server/db.server";
import { politicianMessages } from "./correspondence.server";

const POLLY = "polly.placeholder.mp@parliament.uk";

describeWithDatabase("politicianMessages", () => {
  useTestDatabase();

  it("sorts a letter's messages by who, and keeps automatic replies apart", async () => {
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
  });

  it("tells their office from anyone else on a one-off thread", async () => {
    const polly = await addTestPolitician();
    const id = await thread([polly], "Coffee?", true);
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
  });

  it("gives staff without the permission no supporter's message, name or hidden thread", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({ politicianId: polly });
    await reply(letter, "own", { from: "jane@example.com", name: "Jane Smith", supporter: true });
    await reply(letter, "office", { from: POLLY, name: "Polly" });
    await reply(letter, "elsewhere", { from: "aide@example.org", name: "An Aide" });
    const hidden = await thread([polly], "Theirs", true);
    await message(hidden, "h", "vera@example.com", { name: "Vera Volunteer" });
    const open = await thread([polly], "Ours", false);
    await message(open, "o", POLLY, { name: "Polly" });
    const held = await politicianMessages(polly, []);
    expect(held.letters[letter].map(({ who, name }) => [who, name])).toEqual([
      ["them", "Polly"],
      ["them", null],
    ]);
    expect(held.oneOffs[hidden]).toBeUndefined();
    expect(held.oneOffs[open]).toHaveLength(1);
    expect(JSON.stringify(held)).not.toMatch(/Jane|Vera|An Aide/);
  });

  it("gives a letter's subject to those who may see it, and a mailing's to anyone", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({ politicianId: polly, subject: "Please support this" });
    const [{ mailing }] = await query<{ mailing: number }>(
      "INSERT INTO mailings (title, subject, airtable_field, audience, channel, state) VALUES ('A mailing', 'Our invitation', 'March', 'politicians', 'email', 'sent') RETURNING id::int AS mailing",
    );
    const [{ sent }] = await query<{ sent: number }>(
      "INSERT INTO letters (notable_person_id, status, kind) VALUES ($1, 'sent', 'pauseai') RETURNING id::int AS sent",
      [polly],
    );
    await query("INSERT INTO letters_from_pauseai (id, kind, mailing_id) VALUES ($1, 'pauseai', $2)", [sent, mailing]);
    expect((await politicianMessages(polly, ["supporters"])).subjects).toEqual({
      [letter]: "Please support this",
      [sent]: "Our invitation",
    });
    expect((await politicianMessages(polly, [])).subjects).toEqual({ [letter]: "", [sent]: "Our invitation" });
  });

  it("gives a nameless letter reply no name for those with the permission", async () => {
    const polly = await addTestPolitician();
    const letter = await addTestLetter({ politicianId: polly });
    await reply(letter, "office", { from: POLLY });
    expect((await politicianMessages(polly, ["supporters"])).letters[letter][0].name).toBeNull();
  });
});
