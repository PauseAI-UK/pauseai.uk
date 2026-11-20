import { expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { addFollower } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { createBroadcastDraft } from "./drafts.server";
import { forgetUnreachable, markUnreachable, numberBlocks, numberRefusals, unreachable } from "./unreachable.server";

const NUMBER = "+447700900001";

/** A text broadcast titled `title`, due at `due`, with a copy to NUMBER for `supporter` in `status`; returns the copy's ID. */
async function copyTo(supporter: number, title: string, due: string, status = "sent", skip: string | null = null) {
  const broadcast = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
  await query("UPDATE mailings SET title = $2, due_at = $3 WHERE id = $1", [broadcast, title, due]);
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, skip_reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id`,
    [broadcast, supporter, NUMBER, status, skip],
  );
  return { broadcast, id };
}

describeWithDatabase("numbers WhatsApp can't reach", () => {
  useTestDatabase();

  it("marks a number once, by the newest copy WhatsApp refused, and stops texts to it for two months", async () => {
    const supporter = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    const first = await copyTo(supporter, "First", "2026-10-01T10:00:00Z");
    const second = await copyTo(supporter, "Second", "2026-10-08T10:00:00Z");
    await markUnreachable(NUMBER, first.id);
    await markUnreachable(NUMBER, second.id);
    expect(await query("SELECT number, message_id::int AS copy FROM whatsapp_unreachable")).toEqual([
      { number: NUMBER, copy: second.id },
    ]);
    expect(await unreachable([NUMBER, "+447700900002"])).toEqual(new Set([NUMBER]));
    // Just short of two months on, it still stops texts; just past, the next text tries it again.
    await query("UPDATE whatsapp_unreachable SET at = now() - interval '2 months' + interval '1 minute'");
    expect(await unreachable([NUMBER])).toEqual(new Set([NUMBER]));
    await query("UPDATE whatsapp_unreachable SET at = now() - interval '2 months' - interval '1 minute'");
    expect(await unreachable([NUMBER])).toEqual(new Set());
  });

  it("lists a mark: when, when texts try it again, the copy refused, whose number it is, and how many were skipped", async () => {
    const supporter = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    const refused = await copyTo(supporter, "Refused", "2026-10-01T10:00:00Z", "skipped", "not-on-whatsapp");
    const skipped = await copyTo(supporter, "Skipped", "2026-10-08T10:00:00Z", "skipped", "not-on-whatsapp");
    // Skipped for another reason, so not counted.
    await copyTo(supporter, "Opted out", "2026-10-09T10:00:00Z", "skipped", "unsubscribed");
    await markUnreachable(NUMBER, refused.id);
    await query("UPDATE whatsapp_unreachable SET at = '2026-10-01T10:05:00Z'");
    expect(await numberBlocks([NUMBER, "+447700900002"])).toEqual([
      {
        number: NUMBER,
        since: new Date("2026-10-01T10:05:00Z"),
        triesFrom: new Date("2026-12-01T10:05:00Z"),
        copy: { id: refused.id, broadcast: refused.broadcast, title: "Refused" },
        supporters: [{ id: supporter, name: "Jane" }],
        refused: 1,
      },
    ]);
    // Only the copy refused: the one skipped is counted, not listed.
    expect(await numberRefusals([NUMBER, "+447700900002"])).toEqual([
      {
        number: NUMBER,
        at: new Date("2026-10-01T10:05:00Z"),
        copy: { id: refused.id, broadcast: refused.broadcast, title: "Refused" },
      },
    ]);
    expect(skipped.id).not.toBe(refused.id);
  });

  it("lists a mark whose copy has gone, every skip counted, and whose it is from the copies", async () => {
    // Jane's own record has no number: it's the copy to it that says it's hers.
    const supporter = await addFollower("usr-1", "jane@example.com", "Jane");
    const refused = await copyTo(supporter, "Refused", "2026-10-01T10:00:00Z", "skipped", "not-on-whatsapp");
    await markUnreachable(NUMBER, refused.id);
    await query("UPDATE whatsapp_unreachable SET message_id = NULL");
    const [block] = await numberBlocks([NUMBER]);
    expect(block).toMatchObject({ copy: null, supporters: [{ id: supporter, name: "Jane" }], refused: 1 });
    // With its copy gone, there's no refusal to list.
    expect(await numberRefusals([NUMBER])).toEqual([]);
  });

  it("forgets a mark with a note of why, logged; not without one, nor a number with none", async () => {
    const supporter = await addFollower("usr-1", "jane@example.com", "Jane", { phone: NUMBER });
    const refused = await copyTo(supporter, "Refused", "2026-10-01T10:00:00Z");
    await markUnreachable(NUMBER, refused.id);
    expect(await forgetUnreachable(NUMBER, "jo@pauseai.uk", " ")).toBe(false);
    expect(await forgetUnreachable(NUMBER, "jo@pauseai.uk", "She's on WhatsApp now")).toBe(true);
    expect(await forgetUnreachable(NUMBER, "jo@pauseai.uk", "Again")).toBe(false);
    expect(await query("SELECT number FROM whatsapp_unreachable")).toEqual([]);
    expect(await query("SELECT actor, action, details FROM audit_log WHERE action = 'unblock address'")).toEqual([
      {
        actor: "jo@pauseai.uk",
        action: "unblock address",
        details: { address: NUMBER, note: "She's on WhatsApp now" },
      },
    ]);
  });
});
