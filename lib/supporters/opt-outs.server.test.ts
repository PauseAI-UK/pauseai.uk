import { expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { recordProblem, type DeliveryProblem } from "@/lib/email/email.server";
import {
  lumaCalendarAnswers,
  normaliseAddress,
  optOutOnComplaint,
  recordOptOut,
  recordResubscribe,
  recordStaffOptOut,
} from "./opt-outs.server";

const AT = new Date("2026-10-20T10:00:00Z");
const LATER = new Date("2026-10-21T10:00:00Z");

const jane = (sourceRef = "msg_1", address = "Jane@Example.com ") => ({
  address,
  list: "events" as const,
  source: "luma-webhook" as const,
  sourceRef,
  unsubscribedAt: AT,
});

const rows = () =>
  query<{ address: string; source_ref: string; resubscribed_at: Date | null }>(
    "SELECT address, source_ref, resubscribed_at FROM opt_outs ORDER BY id",
  );

it("trims and lowercases an address", () => {
  expect(normaliseAddress(" Jane@Example.COM ")).toBe("jane@example.com");
});

describeWithDatabase("opt-outs", () => {
  useTestDatabase();

  it("records an opt-out once per source reference, with the address lowercased", async () => {
    expect(await recordOptOut(jane())).toBe(true);
    expect(await recordOptOut(jane())).toBe(false);
    expect(await rows()).toEqual([{ address: "jane@example.com", source_ref: "msg_1", resubscribed_at: null }]);
  });

  it("records a staff member's opt-out once, logging only the one that was new", async () => {
    const choice = { address: "Jane@Example.com", way: "email" as const, list: "newsletter" as const };
    expect(await recordStaffOptOut(choice, "jo@pauseai.uk", { how: "At the stall" })).toBe(true);
    expect(await recordStaffOptOut(choice, "jo@pauseai.uk", { how: "Again" })).toBe(false);
    expect(await query("SELECT count(*)::int AS n FROM audit_log WHERE action = 'record opt-out'")).toEqual([{ n: 1 }]);
  });

  it("keeps one open opt-out per address and list, whatever told us", async () => {
    expect(await recordOptOut(jane("msg_1"))).toBe(true);
    expect(await recordOptOut(jane("msg_2"))).toBe(false);
    expect(await rows()).toHaveLength(1);
  });

  it("opens a new opt-out in place of an open one a yes has outlasted, so the no said again holds", async () => {
    const updates = (sourceRef: string, unsubscribedAt: Date) => ({
      address: "jane@example.com",
      list: "newsletter" as const,
      source: "link" as const,
      sourceRef,
      unsubscribedAt,
    });
    const events = async () =>
      (await query<{ send: string }>("SELECT send FROM contact_permission('events', 'email', 'jane@example.com')"))[0]
        .send;
    // She unsubscribed from Updates, then followed our Luma calendar: the later yes puts her on Updates inc. Luma.
    expect(await recordOptOut(updates("first", AT))).toBe(true);
    await query("INSERT INTO luma_people (user_id, email, contact_since) VALUES ('usr-jane', 'jane@example.com', $1)", [
      LATER,
    ]);
    expect(await events()).toBe("yes");
    // A no dated before her yes changes nothing, as it would lose to it too.
    expect(await recordOptOut(updates("early", new Date("2026-10-20T12:00:00Z")))).toBe(false);
    // Unsubscribing again, from one of those emails, is a new opt-out: the old one ends as the new one starts.
    const AGAIN = new Date("2026-10-22T10:00:00Z");
    expect(await recordOptOut(updates("again", AGAIN))).toBe(true);
    expect(await events()).toBe("no");
    expect(await rows()).toEqual([
      { address: "jane@example.com", source_ref: "first", resubscribed_at: AGAIN },
      { address: "jane@example.com", source_ref: "again", resubscribed_at: null },
    ]);
    // Now it holds, a third is no news.
    expect(await recordOptOut(updates("third", new Date("2026-10-23T10:00:00Z")))).toBe(false);
    expect(await rows()).toHaveLength(2);
  });

  it("closes the open opt-out when the address subscribes again, and a new opt-out opens another", async () => {
    expect(await recordResubscribe("jane@example.com", "events", LATER)).toBe(false);
    await recordOptOut(jane("msg_1"));
    expect(await recordResubscribe("Jane@example.com", "events", LATER)).toBe(true);
    expect(await recordResubscribe("jane@example.com", "events", LATER)).toBe(false);
    expect(await recordOptOut(jane("msg_2"))).toBe(true);
    expect(await rows()).toEqual([
      { address: "jane@example.com", source_ref: "msg_1", resubscribed_at: LATER },
      { address: "jane@example.com", source_ref: "msg_2", resubscribed_at: null },
    ]);
  });
});

describeWithDatabase("lumaCalendarAnswers", () => {
  useTestDatabase();

  it("says whether each address that joined our Luma calendar is on it, since when, or what took it off", async () => {
    const SINCE = new Date("2026-09-01T09:00:00Z");
    await query(
      `INSERT INTO luma_people (user_id, email, contact_since) VALUES
         ('usr-on', 'on@example.com', $1), ('usr-off', 'off@example.com', $1), ('usr-bulk', 'bulk@example.com', $1),
         ('usr-global', 'global@example.com', $1), ('usr-guest', 'guest@example.com', NULL)`,
      [SINCE],
    );
    // Unsubscribed in Luma, then told staff too: the latest is what's said. Every bulk email by our link takes an
    // address off; "No bulk emails" from CiviCRM doesn't, nor does an opt-out of the newsletter.
    await recordOptOut({ ...jane("w1", "off@example.com"), unsubscribedAt: AT });
    await query("UPDATE opt_outs SET resubscribed_at = $1", [LATER]);
    await recordStaffOptOut({ address: "off@example.com", way: "email", list: "events" }, "jo@pauseai.uk", {
      how: "Phoned",
    });
    await recordOptOut({ ...jane("l1", "bulk@example.com"), list: "bulk", source: "link" });
    await recordOptOut({ ...jane("c1", "global@example.com"), list: "bulk", source: "civicrm" });
    await recordOptOut({ ...jane("n1", "on@example.com"), list: "newsletter", source: "link" });
    const answers = await lumaCalendarAnswers([
      "global@example.com",
      "bulk@example.com",
      "off@example.com",
      "guest@example.com",
      "never@example.com",
      "on@example.com",
    ]);
    // In the order asked, none for a guest who never joined the calendar, nor an address Luma never had.
    expect(answers.map((a) => [a.address, a.send, a.reason, a.source])).toEqual([
      ["global@example.com", "yes", "following", "luma"],
      ["bulk@example.com", "no", "no-bulk-email", "link"],
      ["off@example.com", "no", "unsubscribed", "staff"],
      ["on@example.com", "yes", "following", "luma"],
    ]);
    expect(answers[0]).toMatchObject({ topic: "events", way: "email", channel: "email", at: SINCE });
    expect(answers[1].at).toEqual(AT);
  });
});

/** A spam complaint about an email to Jo. */
const COMPLAINT: DeliveryProblem = {
  address: "Jo@Example.org",
  messageId: "msg-1",
  kind: "complaint",
  reason: "Spam",
  canReset: false,
};

describeWithDatabase("optOutOnComplaint", () => {
  useTestDatabase();

  it("opts a complaint's address out of every bulk email, from the copy of a broadcast it names, for CiviCRM", async () => {
    const [{ id: mailing }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
       VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
    );
    const [{ id: copy }] = await query<{ id: number }>(
      `INSERT INTO broadcast_messages (mailing_id, status, provider_message_id) VALUES ($1, 'sent', 'pm-1')
       RETURNING id::int AS id`,
      [mailing],
    );
    await recordProblem({ ...COMPLAINT, messageId: "pm-1" }, optOutOnComplaint);
    await recordProblem({ ...COMPLAINT, address: "sam@example.org", messageId: null }, optOutOnComplaint);
    expect(await query("SELECT address, list, source, message_id::int AS copy FROM opt_outs ORDER BY id")).toEqual([
      { address: "jo@example.org", list: "bulk", source: "postmark-complaint", copy },
      { address: "sam@example.org", list: "bulk", source: "postmark-complaint", copy: null },
    ]);
    expect(await query("SELECT email, change FROM civicrm_updates ORDER BY id")).toEqual([
      { email: "jo@example.org", change: "no_bulk_email" },
      { email: "sam@example.org", change: "no_bulk_email" },
    ]);
  });
});
