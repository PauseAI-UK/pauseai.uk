import { expect, it } from "vitest";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { letterState, letterStateSql } from "@/lib/letters/copy-states";
import { LETTER_STATUSES } from "@/lib/letters/status";
import { createDraft, saveDraft } from "./drafts.server";
import {
  getMailing,
  listMailings,
  mailingCrumb,
  mailingsOverview,
  mailingsPage,
  mailingTitle,
  type RecipientTab,
} from "./records.server";
import { mailingsCopy } from "./copy";

/** A PauseAI letter of the mailing titled `title`, to `politicianId`. */
async function addLetter(
  title: string,
  politicianId: number,
  { status = "sent", sent = "2026-10-01", replied = null as string | null, personalised = false } = {},
) {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO letters (kind, notable_person_id, status, created_at, sent_at, replied_at)
     VALUES ('pauseai', $1, $2, $3, CASE WHEN $2 = 'not_sent' THEN NULL ELSE $3::timestamptz END, $4) RETURNING id::int AS id`,
    [politicianId, status, sent, replied],
  );
  await query(
    `INSERT INTO letters_from_pauseai (id, mailing_id, personalised)
     SELECT $1, id, $3 FROM mailings WHERE title = $2`,
    [id, title, personalised],
  );
  return id;
}

const EDINBURGH = "Edinburgh Conference Nov 26 Invitation";
const CSRB = "CSRB Iqbal Amendment";

describeWithDatabase("mailings", () => {
  useTestDatabase();

  it("lists every mailing, newest sent first, those unsent at the top, with each count", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ name: "Dora Dummy", airtableId: "recDora" });
    const rob = await addTestPolitician({ name: "Rob Example", airtableId: "recRob" });
    await addLetter(EDINBURGH, polly, { sent: "2026-10-02", replied: "2026-10-04", personalised: true });
    await addLetter(EDINBURGH, dora, { sent: "2026-10-01", status: "bounced" });
    await addLetter(EDINBURGH, rob, { status: "not_sent" });
    const jo = await addTestPolitician({ name: "Jo Example", airtableId: "recJo" });
    await addLetter(EDINBURGH, jo, { status: "cancelled" });
    const sam = await addTestPolitician({ name: "Sam Example", airtableId: "recSam" });
    await addLetter(EDINBURGH, sam, { status: "spam_complaint" });
    await addLetter(CSRB, polly, { sent: "2026-06-01" });

    const mailings = await listMailings();
    // The unsent first, the newest made first. For the sending bar, sent is what arrived, a spam complaint too;
    // failed, the bounce and the one not sent.
    expect(mailings.map((m) => [m.title, m.sent, m.failed])).toEqual([
      ["DeepMind letter", 0, 0],
      ["Westminster Hall Debate Invitation", 0, 0],
      ["Documentary Invitation", 0, 0],
      ["Ben Lake October 2026 Debate", 0, 0],
      [EDINBURGH, 2, 2],
      [CSRB, 1, 0],
    ]);
    // Each letter in one state: the reply, the bounce, the one Gmail refused, the one stopped, and the spam complaint.
    expect(mailings[4].states).toEqual({
      look: 0,
      sent: 0,
      replied: 1,
      answered: 0,
      spam: 1,
      error: 1,
      unreached: 1,
      "not-sent": 1,
    });
    expect(mailings[0].states.sent).toBe(0);
    expect(mailings[4]).toMatchObject({
      ask: "edinburgh-conference-2026",
      askTitle: "Edinburgh conference",
      imported: true,
      sentAt: new Date("2026-10-01"),
    });
    expect(mailings[1]).toMatchObject({ ask: null, askTitle: null, sentAt: null });
    // One found by when its emails were sent is imported too, and its ask is the DeepMind letter.
    expect(mailings[0]).toMatchObject({ ask: "deepmind-letter", imported: true, sentAt: null });
  });

  it("gives one mailing with each recipient's outcome, by name; or nothing for no such mailing", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ name: "Dora Dummy", airtableId: "recDora" });
    const letter = await addLetter(EDINBURGH, polly, { replied: "2026-10-04", personalised: true });
    await addLetter(EDINBURGH, dora, { status: "bounced" });
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM mailings WHERE title = $1", [EDINBURGH]);

    const mailing = (await getMailing(id))!;
    expect(mailing.title).toBe(EDINBURGH);
    expect(mailing.recipients).toEqual([
      expect.objectContaining({ name: "Dora Dummy", politicianId: dora, status: "bounced", repliedAt: null }),
      {
        letterId: letter,
        politicianId: polly,
        name: "Polly Placeholder",
        isTest: false,
        constituency: expect.any(String),
        party: expect.any(String),
        status: "sent",
        sentAt: new Date("2026-10-01"),
        repliedAt: new Date("2026-10-04"),
        autoReplied: false,
        replies: 0,
        personalised: true,
        answer: null,
        skipReason: null,
        toCheck: false,
      },
    ]);
    expect(mailing).toMatchObject({ recipientsTotal: 2, page: 1, pages: 1, pageSize: 100 });
    // A page past the last has no one on it, and the same count.
    expect(await getMailing(id, 2)).toMatchObject({ recipients: [], recipientsTotal: 2, page: 2 });
    expect(await getMailing(9999)).toBeUndefined();
    // Its title alone, for its page's title.
    expect(await mailingTitle(id)).toBe(EDINBURGH);
    expect(await mailingTitle(9999)).toBeUndefined();
    // A draft with no subject yet says so.
    const draft = await createDraft("jo@pauseai.uk", { list: "politicians", params: {} }, {});
    expect(await mailingTitle(draft.id)).toBe(mailingsCopy.mailingPages.untitled);
    // In the trail above its page, a sent one is its title, and a draft, whose title changes as it's written, is a draft.
    expect(await mailingCrumb(id)).toBe(EDINBURGH);
    expect(await mailingCrumb(draft.id)).toBe(mailingsCopy.mailingPages.draftCrumb);
    expect(await mailingCrumb(9999)).toBeUndefined();
  });

  it("lists a tab of the recipients, those whose letter is in one state, with their answer to its ask", async () => {
    const polly = await addTestPolitician();
    const dora = await addTestPolitician({ name: "Dora Dummy", airtableId: "recDora" });
    const rob = await addTestPolitician({ name: "Rob Example", airtableId: "recRob" });
    const jo = await addTestPolitician({ name: "Jo Example", airtableId: "recJo" });
    const sam = await addTestPolitician({ name: "Sam Example", airtableId: "recSam" });
    const kim = await addTestPolitician({ name: "Kim Example", airtableId: "recKim" });
    const lee = await addTestPolitician({ name: "Lee Example", airtableId: "recLee" });
    const ann = await addTestPolitician({ name: "Ann Example", airtableId: "recAnn" });
    await addLetter(EDINBURGH, polly, { replied: "2026-10-04" });
    await addLetter(EDINBURGH, dora, { status: "bounced" });
    const skipped = await addLetter(EDINBURGH, rob, { status: "skipped" });
    await query("UPDATE letters_from_pauseai SET skip_reason = 'left-office' WHERE id = $1", [skipped]);
    await addLetter(EDINBURGH, jo, { status: "cancelled" });
    await addLetter(EDINBURGH, sam, { status: "uncertain" });
    await addLetter(EDINBURGH, kim, { status: "spam_complaint" });
    await addLetter(EDINBURGH, lee, { replied: "2026-10-05" });
    await addLetter(EDINBURGH, ann);
    // Polly answered, and so did Dora, whose letter bounced: a letter that didn't go is in its own state. Staff
    // marked Ann invited as well, which is no answer.
    await query(
      `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
       VALUES ($1, 'edinburgh-conference-2026', 'event', 'going', 'staff'), ($2, 'edinburgh-conference-2026', 'event', 'going', 'staff'),
         ($3, 'edinburgh-conference-2026', 'event', 'invited', 'staff')`,
      [polly, dora, ann],
    );
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM mailings WHERE title = $1", [EDINBURGH]);
    const names = async (tab: RecipientTab) => (await getMailing(id, 1, tab))!.recipients.map((r) => r.name);
    expect(await names("answered")).toEqual(["Polly Placeholder"]);
    expect(await names("replied")).toEqual(["Lee Example"]);
    expect(await names("sent")).toEqual(["Ann Example"]);
    expect((await getMailing(id, 1, "sent"))!.recipients[0].answer).toBeNull();
    expect(await names("spam")).toEqual(["Kim Example"]);
    expect(await names("error")).toEqual(["Sam Example"]);
    expect(await names("unreached")).toEqual(["Dora Dummy"]);
    expect(await names("not-sent")).toEqual(["Jo Example", "Rob Example"]);
    const mailing = (await getMailing(id, 1, "not-sent"))!;
    expect(mailing).toMatchObject({ tab: "not-sent", recipientsTotal: 2, to: 8, answered: 2 });
    expect(mailing.recipients.map((r) => r.skipReason)).toEqual([null, "left-office"]);
    expect(mailing.states).toEqual({
      look: 0,
      sent: 1,
      replied: 1,
      answered: 1,
      spam: 1,
      error: 1,
      unreached: 1,
      "not-sent": 2,
    });
  });

  it("puts a letter whose reply nobody has dealt with in to check, until something at or after it deals with it", async () => {
    const people = ["Polly", "Dora", "Rob", "Jo", "Sam", "Kim", "Lee", "Ann", "Ben"];
    const ids = new Map<string, number>();
    for (const name of people) {
      const politician = await addTestPolitician({ name: `${name} Example`, airtableId: `rec${name}` });
      ids.set(name, politician);
      ids.set(`${name} letter`, await addLetter(EDINBURGH, politician, { replied: "2026-10-04" }));
    }
    const letter = (name: string) => ids.get(`${name} letter`)!;
    let gmail = 0;
    const message = async (name: string, at: string, { fromUs = false, dealtBy = null as string | null } = {}) => {
      gmail++;
      const [{ id }] = await query<{ id: number }>(
        `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, at, from_us,
           blob_key, size, dealt_by, dealt_at)
         VALUES ($1, 'policy@pauseai.uk', $2, 't', $3, $4, $5, $2, 1, $6, CASE WHEN $6::text IS NOT NULL THEN now() END)
         RETURNING id::int AS id`,
        [letter(name), `g${gmail}`, fromUs ? "policy@pauseai.uk" : "office@parliament.uk", at, fromUs, dealtBy],
      );
      return { id, gmail: `g${gmail}` };
    };
    const ask = (name: string, by: string, at: string) =>
      query(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by, updated_at)
         VALUES ($1, 'edinburgh-conference-2026', 'event', 'going', $2, $3)`,
        [ids.get(name), by, at],
      );
    // Polly's reply waits.
    await message("Polly", "2026-10-04");
    // Our answer after Dora's deals with it; Nothing to do on Rob's.
    await message("Dora", "2026-10-04");
    await message("Dora", "2026-10-05", { fromUs: true });
    await message("Rob", "2026-10-04", { dealtBy: "jo@pauseai.uk" });
    // Jo's was automatic, as its event says.
    const auto = await message("Jo", "2026-10-04");
    await query(
      `INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'auto_reply', jsonb_build_object('gmailMessageId', $2::text))`,
      [letter("Jo"), auto.gmail],
    );
    // A staff member set Sam's answer to the ask after it came; an import set Kim's; Lee's was set before.
    await message("Sam", "2026-10-04");
    await ask("Sam", "jo@pauseai.uk", "2026-10-05");
    await message("Kim", "2026-10-04");
    await ask("Kim", "controlai", "2026-10-05");
    await ask("Lee", "jo@pauseai.uk", "2026-10-01");
    await message("Lee", "2026-10-04");
    // Ann wrote again after our answer; Ben's latest is marked, which deals with his first too.
    await message("Ann", "2026-10-04");
    await message("Ann", "2026-10-05", { fromUs: true });
    await message("Ann", "2026-10-06");
    await message("Ben", "2026-10-04");
    await message("Ben", "2026-10-06", { dealtBy: "jo@pauseai.uk" });
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM mailings WHERE title = $1", [EDINBURGH]);
    const names = async (tab: RecipientTab) => (await getMailing(id, 1, tab))!.recipients.map((r) => r.name);
    expect(await names("look")).toEqual(["Ann Example", "Kim Example", "Lee Example", "Polly Example"]);
    expect(await names("replied")).toEqual(["Ben Example", "Dora Example", "Jo Example", "Rob Example"]);
    expect(await names("answered")).toEqual(["Sam Example"]);
    const mailing = (await getMailing(id))!;
    expect(mailing.states.look).toBe(4);
    expect(mailing.recipients.filter((r) => r.toCheck).map((r) => r.name)).toEqual(await names("look"));
  });

  it("puts a letter in the same state in SQL as on its tag, for every status, answered, replied, to check or none", async () => {
    const cases = LETTER_STATUSES.flatMap((status) =>
      [false, true].flatMap((answered) =>
        [false, true].flatMap((replied) => [false, true].map((toCheck) => ({ status, answered, replied, toCheck }))),
      ),
    );
    const rows = await query<{ state: string }>(
      `SELECT ${letterStateSql("c.answered", "c.to_check")} AS state
       FROM jsonb_to_recordset($1::jsonb) AS c(status text, answered boolean, replied boolean, to_check boolean),
         LATERAL (SELECT c.status, CASE WHEN c.replied THEN now() END AS replied_at) l`,
      [JSON.stringify(cases.map(({ toCheck, ...one }) => ({ ...one, to_check: toCheck })))],
    );
    expect(rows.map((row) => row.state)).toEqual(cases.map((one) => letterState(one).state));
  });

  it("puts the mailings in parts: those scheduled, those sending, drafts, and those done with", async () => {
    await addTestPolitician({ house: "lords" });
    await addTestPolitician({ name: "Dora Dummy", airtableId: "recDora" });
    const lords = await createDraft(
      "jo@pauseai.uk",
      { list: "politicians", params: { house: "lords" } },
      { subject: "Lords" },
    );
    const all = await createDraft("jo@pauseai.uk", { list: "politicians", params: {} }, { subject: "Everyone" });
    await saveDraft(lords.id, 1, { subject: "To the Lords" });
    const later = await createDraft("jo@pauseai.uk", { list: "politicians", params: {} }, { subject: "Later" });
    const sooner = await createDraft("jo@pauseai.uk", { list: "politicians", params: {} }, { subject: "Sooner" });
    await query(
      "UPDATE mailings SET state = 'scheduled', due_at = '2026-12-01', sent_from = 'jo@pauseai.uk', from_name = 'Jo' WHERE id = $1",
      [later.id],
    );
    await query(
      "UPDATE mailings SET state = 'sending', due_at = '2026-11-01', sent_from = 'jo@pauseai.uk', from_name = 'Jo' WHERE id = $1",
      [sooner.id],
    );
    // Scheduled too, before Later, though made after it.
    const next = await createDraft("jo@pauseai.uk", { list: "politicians", params: {} }, { subject: "Next" });
    await query(
      "UPDATE mailings SET state = 'scheduled', due_at = '2026-11-20', sent_from = 'jo@pauseai.uk', from_name = 'Jo' WHERE id = $1",
      [next.id],
    );

    const { scheduled, sending, drafts, done } = await mailingsOverview();
    // The newest edited first, each with how many its filter finds now.
    expect(drafts.map((m) => [m.title, m.to, m.state, m.createdBy])).toEqual([
      ["To the Lords", 1, "draft", "jo@pauseai.uk"],
      ["Everyone", 2, "draft", "jo@pauseai.uk"],
    ]);
    expect(drafts[1].id).toBe(all.id);
    expect(scheduled.map((m) => m.title)).toEqual(["Next", "Later"]);
    expect(sending.map((m) => m.title)).toEqual(["Sooner"]);
    expect(done.map((m) => m.title)).toContain(EDINBURGH);
    expect(done.map((m) => m.state)).not.toContain("draft");
    // The list for the download leaves the drafts out.
    expect((await listMailings()).map((m) => m.title)).not.toContain("Everyone");
    // The page's groups, Scheduled first, and when now is.
    const page = await mailingsPage();
    expect(page.groups.slice(0, 3).map((g) => [g.heading, g.mailings.map((m) => m.title)])).toEqual([
      [mailingsCopy.mailingPages.scheduled, ["Next", "Later"]],
      [mailingsCopy.mailingPages.sending, ["Sooner"]],
      [mailingsCopy.mailingPages.drafts, ["To the Lords", "Everyone"]],
    ]);
    expect(Date.parse(page.now)).not.toBeNaN();
  });
});
