import { expect, it } from "vitest";
import { addTestLetter, addTestMp, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query, transaction } from "@/lib/server/db.server";
import { letterEvent, transition } from "./lifecycle.server";
import { sql } from "@/lib/server/sql.server";

const letter = async (id: number) =>
  (
    await query<{ status: string; taken: boolean; sent: boolean }>(
      `SELECT status, taken_at IS NOT NULL AS taken, sent_at IS NOT NULL AS sent FROM letters WHERE id = $1`,
      [id],
    )
  )[0];
const events = async (id: number) =>
  query<{ status: string; details: object }>(
    "SELECT status, details FROM letter_events WHERE letter_id = $1 ORDER BY id",
    [id],
  );

describeWithDatabase("a letter's transitions", () => {
  useTestDatabase();

  it("moves a letter in a status it's allowed from, stamping the time and logging its event", async () => {
    const id = await addTestLetter({ politicianId: await addTestMp(), status: "queued", sentAt: null });
    expect(await transition(id, ["queued"], "sending", { stamp: "taken_at" })).toEqual([id]);
    expect(await letter(id)).toEqual({ status: "sending", taken: true, sent: false });
    expect(await events(id)).toEqual([]);
    await transition(id, ["sending"], "sent", { event: "sent", details: { to: "mp@example.com" }, stamp: "sent_at" });
    expect(await letter(id)).toEqual({ status: "sent", taken: true, sent: true });
    expect(await events(id)).toEqual([{ status: "sent", details: { to: "mp@example.com" } }]);
  });

  it("leaves a letter in any other status as it is, logging nothing", async () => {
    const id = await addTestLetter({ politicianId: await addTestMp(), status: "sent" });
    expect(await transition(id, ["queued"], "sending", { event: "queued" })).toEqual([]);
    expect((await letter(id)).status).toBe("sent");
    expect(await events(id)).toEqual([]);
  });

  it("moves the letters a query selects, in a transaction, each with its own event", async () => {
    const mp = await addTestMp();
    const [one, two, sent] = [
      await addTestLetter({ politicianId: mp, status: "queued" }),
      await addTestLetter({ politicianId: mp, status: "queued" }),
      await addTestLetter({ politicianId: mp, status: "sent" }),
    ];
    const moved = await transaction((db) =>
      transition(
        sql`SELECT id FROM letters WHERE notable_person_id = ${mp}`,
        ["queued"],
        "not_sent",
        { event: "failed" },
        db,
      ),
    );
    expect(moved).toEqual([one, two]);
    expect((await events(one))[0]).toEqual({ status: "failed", details: {} });
    expect(await events(sent)).toEqual([]);
  });

  it("logs an event that doesn't change the status", async () => {
    const id = await addTestLetter({ politicianId: await addTestMp() });
    await letterEvent(id, "notice", { notice: "bounced" });
    await letterEvent(id, "copy_sent");
    expect(await events(id)).toEqual([
      { status: "notice", details: { notice: "bounced" } },
      { status: "copy_sent", details: {} },
    ]);
  });
});
