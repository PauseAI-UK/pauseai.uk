import { expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { addFollower } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { createBroadcastDraft } from "./broadcast-drafts.server";
import { numberOf, recordWhatsAppResume, recordWhatsAppStop } from "./whatsapp-stops.server";

const AT = new Date("2026-11-02T10:00:00Z");
const LATER = new Date("2026-11-03T10:00:00Z");
const NUMBER = "+447700900123";

it("gives a number as WhatsApp gives it in our international format", () => {
  expect(numberOf("447700900123")).toBe(NUMBER);
  expect(numberOf("+44 7700 900123")).toBe(NUMBER);
});

/** Each opt-out of the number, by topic, as kept. */
const stops = () =>
  query<{ list: string; ref: string; copy: number | null; back: boolean }>(
    `SELECT list, source_ref AS ref, message_id::int AS copy, resubscribed_at IS NOT NULL AS back
     FROM opt_outs WHERE address = $1 ORDER BY id`,
    [NUMBER],
  );

describeWithDatabase("stops given in WhatsApp", () => {
  useTestDatabase();

  it("stops every text to the number, once however often it's told, and sends CiviCRM Do not SMS", async () => {
    expect(await recordWhatsAppStop(NUMBER, "setting", "447700900123 1730000000", AT)).toBe(true);
    // One stop of every text, whatever topics a text goes under now or later.
    expect(await stops()).toEqual([
      { list: "all", ref: "setting 447700900123 1730000000 all", copy: null, back: false },
    ]);
    expect(
      (await query<{ send: string }>("SELECT send FROM contact_permission('volunteering', 'text', $1)", [NUMBER]))[0],
    ).toEqual({ send: "no" });
    expect(await query("SELECT change, phone FROM civicrm_updates")).toEqual([{ change: "do_not_sms", phone: NUMBER }]);
    expect(await recordWhatsAppStop(NUMBER, "setting", "447700900123 1730000000", AT)).toBe(false);
    expect(await stops()).toHaveLength(1);
  });

  it("says Stopped in the history of the copy it came from", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: NUMBER });
    const id = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    const [{ copy }] = await query<{ copy: number }>(
      `INSERT INTO broadcast_messages (mailing_id, status) VALUES ($1, 'sent') RETURNING id::int AS copy`,
      [id],
    );
    expect(await recordWhatsAppStop(NUMBER, "reply", "wamid.1", AT, copy)).toBe(true);
    // A copy that doesn't say its topics: every text.
    expect((await stops()).map((stop) => [stop.list, stop.copy])).toEqual([["all", copy]]);
    expect(await query("SELECT kind, at FROM broadcast_message_events WHERE message_id = $1", [copy])).toEqual([
      { kind: "opted-out", at: AT },
    ]);
    // Told again, it's no new stop, and the history says it once.
    expect(await recordWhatsAppStop(NUMBER, "reply", "wamid.1", AT, copy)).toBe(false);
    expect(await query("SELECT 1 FROM broadcast_message_events WHERE message_id = $1", [copy])).toHaveLength(1);
  });

  it("stops only the topics of the copy a reply answers, as its footer says", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: NUMBER });
    const id = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    const [{ copy }] = await query<{ copy: number }>(
      `INSERT INTO broadcast_messages (mailing_id, status, topics) VALUES ($1, 'sent', '{events}') RETURNING id::int AS copy`,
      [id],
    );
    expect(await recordWhatsAppStop(NUMBER, "reply", "wamid.1", AT, copy)).toBe(true);
    expect((await stops()).map((stop) => stop.ref)).toEqual(["reply wamid.1 events"]);
    // Not every text topic stopped: no "Do not SMS" for CiviCRM.
    expect(await query("SELECT 1 FROM civicrm_updates")).toEqual([]);
  });

  it("lifts only the stops WhatsApp's setting made when the person turns it back on", async () => {
    await recordWhatsAppStop(NUMBER, "setting", "447700900123 1730000000", AT);
    expect(await recordWhatsAppResume(NUMBER, LATER)).toBe(true);
    expect((await stops()).every((stop) => stop.back)).toBe(true);
    expect(await recordWhatsAppResume(NUMBER, LATER)).toBe(false);
    // A stop by a reply stays, whatever the setting says.
    await recordWhatsAppStop(NUMBER, "reply", "wamid.2", LATER);
    expect(await recordWhatsAppResume(NUMBER, LATER)).toBe(false);
    expect((await stops()).filter((stop) => !stop.back).map((stop) => stop.ref)).toEqual(["reply wamid.2 all"]);
  });
});
