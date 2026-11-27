import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { linkSupporters } from "@/lib/supporters/records.server";
import { broadcastTerms } from "./broadcasts";
import { eventAudience } from "./event-audience.server";

/** A Luma user registered for `event` with `status`, following our calendar unless `follows` is false. */
async function guest(id: string, event: string, status: string, follows = true) {
  await query("INSERT INTO luma_people (user_id, email, name, contact_since) VALUES ($1, $2, $1, $3)", [
    id,
    `${id}@example.com`,
    follows ? "2026-09-01T10:00:00Z" : null,
  ]);
  await query(
    `INSERT INTO luma_events (id, name, url, start_at, access) VALUES ($1, $1, $1, '2026-12-01T18:00:00Z', 'manage')
     ON CONFLICT DO NOTHING`,
    [event],
  );
  await query(
    `INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at)
     VALUES ($1, $2, $3, $4, '2026-11-01T10:00:00Z')`,
    [`gst-${id}`, event, id, status],
  );
}

describeWithDatabase("eventAudience", () => {
  useTestDatabase();

  it("finds the event's guests who aren't declined and may be emailed our updates including Luma", async () => {
    await guest("usr-going", "evt-1", "approved");
    await guest("usr-waiting", "evt-1", "waitlist");
    await guest("usr-declined", "evt-1", "declined");
    await guest("usr-unfollowed", "evt-1", "approved", false);
    await guest("usr-elsewhere", "evt-2", "approved");
    await linkSupporters();

    const { search, total } = await eventAudience("evt-1");
    expect(total).toBe(2);
    expect(search.event).toEqual(["evt-1"]);
    expect(broadcastTerms(search.contact)).toEqual({ channel: "email", topics: ["newsletter", "events"] });
  });
});
