import { expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { recordProblem, type DeliveryProblem } from "@/lib/email/email.server";
import { createBroadcastDraft } from "@/lib/broadcasts/drafts.server";
import { forgetUnreachable, markUnreachable } from "@/lib/broadcasts/unreachable.server";
import { addFollower } from "@/tests/broadcast-fixtures";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { BLOCKS_PAGE_SIZE } from "@/lib/email/block-filters";
import type { BlockSort } from "@/lib/staff-lists";
import { listBlocks } from "./blocks.server";

const NUMBER = "+447700900001";

/** A bounce of an email we sent for `purpose` to `address`, `at`, by the send log's ID `messageId`. */
async function bounced(address: string, purpose: string, at: string, more: Partial<DeliveryProblem> = {}) {
  const messageId = `msg-${address}`;
  await query("INSERT INTO email_sends (at, purpose, address, outcome, message_id) VALUES ($1, $2, $3, 'sent', $4)", [
    at,
    purpose,
    address,
    messageId,
  ]);
  await recordProblem({ address, messageId, kind: "hard", reason: "Unknown user", canReset: true, ...more });
  await query("UPDATE email_problems SET at = $1 WHERE id = (SELECT max(id) FROM email_problems)", [at]);
}

/** A text broadcast with a copy to NUMBER that WhatsApp refused, `at`; returns the copy's and broadcast's IDs. */
async function refusedText(supporter: number, at: string) {
  const broadcast = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
  await query("UPDATE mailings SET title = 'Join us', due_at = $2 WHERE id = $1", [broadcast, at]);
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, skip_reason)
     VALUES ($1, $2, $3, 'skipped', 'not-on-whatsapp') RETURNING id::int AS id`,
    [broadcast, supporter, NUMBER],
  );
  await markUnreachable(NUMBER, id);
  await query("UPDATE whatsapp_unreachable SET at = $1", [at]);
  return { id, broadcast };
}

const addresses = (list: { blocks: { address: string }[] }) => list.blocks.map((block) => block.address);

describeWithDatabase("listBlocks", () => {
  useTestDatabase();

  it("lists blocked addresses and numbers together, newest first, a politician's apart", async () => {
    await addTestPolitician({ email: "mp@parliament.example" });
    const jane = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    await bounced("mp@parliament.example", "letter", "2026-10-01T10:00:00Z");
    await bounced("old@example.org", "mailing", "2026-10-02T10:00:00Z");
    const text = await refusedText(jane, "2026-10-03T10:00:00Z");
    await bounced("new@example.org", "staff-login", "2026-10-04T10:00:00Z");

    expect(await listBlocks("politicians", {}, 1)).toEqual({
      total: 1,
      blocks: [expect.objectContaining({ channel: "email", address: "mp@parliament.example", triesFrom: null })],
    });
    const others = await listBlocks("others", {}, 1);
    expect(others.total).toBe(3);
    expect(addresses(others)).toEqual(["new@example.org", NUMBER, "old@example.org"]);
    expect(others.blocks[1]).toEqual({
      channel: "text",
      address: NUMBER,
      kind: "not-on-whatsapp",
      reason: "",
      since: new Date("2026-10-03T10:00:00Z"),
      canReset: true,
      foundInGmail: false,
      mailbox: null,
      politicians: [],
      supporters: [{ id: jane, name: "Jane" }],
      letter: null,
      purpose: "broadcast",
      found: "broadcast",
      copy: { id: text.id, broadcast: text.broadcast, title: "Join us" },
      refused: 0,
      triesFrom: new Date("2026-12-03T10:00:00Z"),
      history: [
        {
          at: new Date("2026-10-03T10:00:00Z"),
          what: "refused",
          copy: { id: text.id, broadcast: text.broadcast, title: "Join us" },
        },
      ],
    });
  });

  it("filters by what blocked it, what found it out, and a search of addresses and numbers as typed", async () => {
    const jane = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    await bounced("broadcast@example.org", "broadcast", "2026-10-01T10:00:00Z");
    await bounced("letter@example.org", "letter-copy", "2026-10-02T10:00:00Z");
    await bounced("mailing@example.org", "mailing", "2026-10-03T10:00:00Z", { kind: "complaint" });
    await bounced("other@example.org", "preferences-link", "2026-10-04T10:00:00Z");
    await recordProblem({ address: "hold@example.org", messageId: null, kind: "hard", reason: "", canReset: true });
    await query("UPDATE email_problems SET kind = 'hold' WHERE address = 'hold@example.org'");
    // Bounces of emails the site has no record of sending: one read from a mailbox, one from Postmark.
    await recordProblem({
      address: "mailbox@example.org",
      messageId: null,
      kind: "hard",
      reason: "",
      canReset: true,
      gmailMessageId: "g1",
    });
    await recordProblem({
      address: "stray@example.org",
      messageId: "msg-unknown",
      kind: "hard",
      reason: "",
      canReset: true,
    });
    await refusedText(jane, "2026-10-05T10:00:00Z");

    const found = async (filter: Parameters<typeof listBlocks>[1]) => addresses(await listBlocks("others", filter, 1));
    expect(await found({ kind: "not-on-whatsapp" })).toEqual([NUMBER]);
    expect(await found({ kind: "complaint" })).toEqual(["mailing@example.org"]);
    expect(await found({ found: "broadcast" })).toEqual([NUMBER, "broadcast@example.org"]);
    expect(await found({ found: "letter" })).toEqual(["letter@example.org"]);
    expect(await found({ found: "mailing" })).toEqual(["mailing@example.org"]);
    expect(await found({ found: "other" })).toEqual(["other@example.org"]);
    expect(await found({ found: "held" })).toEqual(["hold@example.org"]);
    expect(await found({ found: "mailbox" })).toEqual(["mailbox@example.org"]);
    expect(await found({ found: "unrecorded" })).toEqual(["stray@example.org"]);
    // Who told us: WhatsApp of a number, CiviCRM of a hold, a mailbox's Gmail, else Postmark.
    expect(await found({ backend: "whatsapp" })).toEqual([NUMBER]);
    expect(await found({ backend: "civicrm" })).toEqual(["hold@example.org"]);
    expect(await found({ backend: "gmail" })).toEqual(["mailbox@example.org"]);
    expect(await found({ backend: "postmark" })).not.toContain("hold@example.org");
    expect(await found({ search: "LETTER@" })).toEqual(["letter@example.org"]);
    // A number found as it's written in the UK, or by part of it as kept.
    expect(await found({ search: "07700 900001" })).toEqual([NUMBER]);
    expect(await found({ search: "900001" })).toEqual([NUMBER]);
    expect(await found({ search: "nobody" })).toEqual([]);
  });

  it("sorts by each sortable column, either way, then newest first", async () => {
    const jane = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    await bounced("b@example.org", "letter", "2026-10-01T10:00:00Z");
    await bounced("a@example.org", "mailing", "2026-10-02T10:00:00Z", { kind: "complaint" });
    await refusedText(jane, "2026-10-03T10:00:00Z");
    // Stopped twice since it was blocked, the most of any.
    await query(
      `INSERT INTO email_sends (at, purpose, address, outcome) VALUES
       ('2026-10-05T10:00:00Z', 'letter', 'b@example.org', 'refused'), ('2026-10-06T10:00:00Z', 'letter', 'b@example.org', 'refused')`,
    );
    const sorted = async (key: BlockSort, dir: "asc" | "desc") =>
      addresses(await listBlocks("others", { sort: { key, dir } }, 1));
    expect(await sorted("since", "desc")).toEqual([NUMBER, "a@example.org", "b@example.org"]);
    expect(await sorted("since", "asc")).toEqual(["b@example.org", "a@example.org", NUMBER]);
    expect(await sorted("address", "asc")).toEqual([NUMBER, "a@example.org", "b@example.org"]);
    expect(await sorted("kind", "asc")).toEqual(["a@example.org", "b@example.org", NUMBER]);
    expect(await sorted("backend", "desc")).toEqual([NUMBER, "a@example.org", "b@example.org"]);
    expect(await sorted("sent", "asc")).toEqual([NUMBER, "b@example.org", "a@example.org"]);
    expect(await sorted("refused", "desc")).toEqual(["b@example.org", NUMBER, "a@example.org"]);
  });

  it("gives a page at a time, or every one", async () => {
    await query(
      `WITH p AS (
         INSERT INTO email_problems (address, kind, reason, can_reset, at)
         SELECT 'a' || n || '@example.org', 'hard', '', true, '2026-10-01'::timestamptz + n * interval '1 minute'
         FROM generate_series(1, $1) n RETURNING id, address)
       INSERT INTO email_blocks (address, problem_id) SELECT address, id FROM p`,
      [BLOCKS_PAGE_SIZE + 1],
    );
    const first = await listBlocks("others", {}, 1);
    expect(first.total).toBe(BLOCKS_PAGE_SIZE + 1);
    expect(first.blocks).toHaveLength(BLOCKS_PAGE_SIZE);
    expect(addresses(await listBlocks("others", {}, 2))).toEqual(["a1@example.org"]);
    expect((await listBlocks("others", {}, "all")).blocks).toHaveLength(BLOCKS_PAGE_SIZE + 1);
  });

  it("gives each its history: bounces soft and hard and from which mailbox, texts refused and skipped, and unblocks", async () => {
    const jane = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    await recordProblem({
      address: "jo@example.org",
      messageId: null,
      kind: "soft",
      reason: "Mailbox full",
      canReset: true,
      gmailMessageId: "g1",
      details: { account: "sam@pauseai.uk" },
    });
    await query("UPDATE email_problems SET at = '2026-10-01T10:00:00Z'");
    await bounced("jo@example.org", "broadcast", "2026-10-02T10:00:00Z");
    // Unblocked once before, and blocked again.
    await query(
      `INSERT INTO audit_log (at, actor, action, details) VALUES
       ('2026-10-03T10:00:00Z', 'sam@pauseai.uk', 'unblock address', '{"address": "jo@example.org", "note": "Fixed"}')`,
    );
    await recordProblem({ address: "jo@example.org", messageId: null, kind: "hard", reason: "Gone", canReset: true });
    await query("UPDATE email_problems SET at = '2026-10-04T10:00:00Z' WHERE reason = 'Gone'");
    // A number unblocked, then refused again, then skipped by a later text.
    const first = await refusedText(jane, "2026-10-05T10:00:00Z");
    await forgetUnreachable(NUMBER, "sam@pauseai.uk", "On WhatsApp now");
    await query("UPDATE audit_log SET at = '2026-10-06T10:00:00Z' WHERE details->>'address' = $1", [NUMBER]);
    const second = await refusedText(jane, "2026-10-07T10:00:00Z");
    const skipped = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    await query("UPDATE mailings SET title = 'Later', due_at = '2026-10-08T10:00:00Z' WHERE id = $1", [skipped]);
    const [{ id: skip }] = await query<{ id: number }>(
      `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, skip_reason)
       VALUES ($1, $2, $3, 'skipped', 'not-on-whatsapp') RETURNING id::int AS id`,
      [skipped, jane, NUMBER],
    );

    const { blocks } = await listBlocks("others", {}, 1);
    const historyOf = (address: string) => blocks.find((block) => block.address === address)!.history;
    expect(historyOf("jo@example.org")).toEqual([
      { at: new Date("2026-10-04T10:00:00Z"), what: "hard", reason: "Gone", mailbox: null },
      { at: new Date("2026-10-03T10:00:00Z"), what: "unblocked", by: "sam@pauseai.uk", note: "Fixed" },
      { at: new Date("2026-10-02T10:00:00Z"), what: "hard", reason: "Unknown user", mailbox: null },
      { at: new Date("2026-10-01T10:00:00Z"), what: "soft", reason: "Mailbox full", mailbox: "sam@pauseai.uk" },
    ]);
    expect(historyOf(NUMBER)).toEqual([
      {
        at: new Date("2026-10-08T10:00:00Z"),
        what: "skipped",
        copy: { id: skip, broadcast: skipped, title: "Later" },
      },
      {
        at: new Date("2026-10-07T10:00:00Z"),
        what: "refused",
        copy: { id: second.id, broadcast: second.broadcast, title: "Join us" },
      },
      { at: new Date("2026-10-06T10:00:00Z"), what: "unblocked", by: "sam@pauseai.uk", note: "On WhatsApp now" },
      // The copy that marked it before is placed when its broadcast was due, as the mark has moved on.
      {
        at: new Date("2026-10-05T10:00:00Z"),
        what: "skipped",
        copy: { id: first.id, broadcast: first.broadcast, title: "Join us" },
      },
    ]);
  });

  it("names the broadcast whose email found an address out", async () => {
    const jane = await addFollower("usr-1", "jane@example.com", "Jane");
    const broadcast = (await createBroadcastDraft("jo@pauseai.uk", { contact: "email:events:yes" }))!;
    await query("UPDATE mailings SET title = 'News' WHERE id = $1", [broadcast]);
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status)
       VALUES ($1, $2, 'jane@example.com', 'sent') RETURNING id::int AS id`,
      [broadcast, jane],
    );
    await bounced("jane@example.com", "broadcast", "2026-10-01T10:00:00Z");
    await query("UPDATE email_sends SET broadcast_message_id = $1", [id]);
    const [block] = (await listBlocks("others", {}, 1)).blocks;
    expect(block.copy).toEqual({ id, broadcast, title: "News" });
  });
});
