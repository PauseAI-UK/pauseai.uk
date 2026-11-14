import { expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { recordProblem, type DeliveryProblem } from "@/lib/email/email.server";
import {
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
