import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { eventPage } from "./event-page.server";

/** One of our events, or with `view`, one another calendar runs. */
async function addEvent(id: string, access = "manage") {
  await query(
    `INSERT INTO luma_events (id, name, url, start_at, access, city) VALUES ($1, $2, $1, '2026-12-01T18:00:00Z', $3, 'London')`,
    [id, `Event ${id}`, access],
  );
}

/** A guest of `eventId`, with their name on Luma, and what's on their registration. */
async function addGuest(
  id: string,
  eventId: string,
  name: string,
  more: { status?: string; removed?: boolean; postcode?: string; phone?: string; cameFrom?: string } = {},
) {
  await query("INSERT INTO luma_people (user_id, email, name) VALUES ($1, $2, $3)", [
    `usr-${id}`,
    `${id}@example.com`,
    name,
  ]);
  await query(
    `INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at, changed_at, postcode, phone, utm_source,
       removed_at)
     VALUES ($1, $2, $3, $4, '2026-11-01T10:00:00Z', '2026-11-03T10:00:00Z', $5, $6, $7, CASE WHEN $8 THEN now() END)`,
    [
      id,
      eventId,
      `usr-${id}`,
      more.status ?? "approved",
      more.postcode ?? null,
      more.phone ?? null,
      more.cameFrom ?? null,
      more.removed ?? false,
    ],
  );
}

describeWithDatabase("eventPage", () => {
  useTestDatabase();

  it("has the event and its guests Luma lists, by status then name, those with none last, each with their supporter", async () => {
    await addEvent("evt-1");
    await addGuest("gst-zoe", "evt-1", "Zoe");
    await addGuest("gst-ann", "evt-1", "ann", { postcode: "M1 1AE", phone: "+447700900001", cameFrom: "brixton" });
    await addGuest("gst-none", "evt-1", "");
    await addGuest("gst-wait", "evt-1", "Bea", { status: "waitlist" });
    await addGuest("gst-declined", "evt-1", "Al", { status: "declined" });
    await addGuest("gst-pending", "evt-1", "Cy", { status: "pending_approval" });
    await addGuest("gst-removed", "evt-1", "Gone", { removed: true });
    await addEvent("evt-other");
    await addGuest("gst-other", "evt-other", "Other");
    await query("INSERT INTO supporters (id) OVERRIDING SYSTEM VALUE VALUES (7)");
    await query(
      `INSERT INTO supporter_links (supporter_id, luma_user_id, matched_by, matched_value)
       VALUES (7, 'usr-gst-ann', 'email', 'gst-ann@example.com')`,
    );

    const found = await eventPage("evt-1", true);
    expect(found!.event).toMatchObject({ id: "evt-1", name: "Event evt-1", going: 3, url: "https://luma.com/evt-1" });
    expect(found!.event).not.toHaveProperty("hostEmails");
    expect(found!.guests!.map((guest) => guest.id)).toEqual([
      "gst-ann",
      "gst-zoe",
      "gst-none",
      "gst-pending",
      "gst-wait",
      "gst-declined",
    ]);
    expect(found!.guests![0]).toEqual({
      id: "gst-ann",
      name: "ann",
      email: "gst-ann@example.com",
      supporterId: 7,
      status: "approved",
      registeredAt: new Date("2026-11-01T10:00:00Z"),
      changedAt: new Date("2026-11-03T10:00:00Z"),
      postcode: "M1 1AE",
      phone: "+447700900001",
      cameFrom: "brixton",
    });
    expect(found!.guests![1]).toMatchObject({ supporterId: null, postcode: null, phone: null, cameFrom: null });
  });

  it("has no guests for staff who don't see supporters", async () => {
    await addEvent("evt-1");
    await addGuest("gst-ann", "evt-1", "Ann");
    expect(await eventPage("evt-1", false)).toMatchObject({ event: { id: "evt-1", hosts: [] }, guests: null });
  });

  it("finds no event that isn't ours, or that we don't know", async () => {
    await addEvent("evt-theirs", "view");
    expect(await eventPage("evt-theirs", true)).toBeUndefined();
    expect(await eventPage("evt-unknown", true)).toBeUndefined();
  });
});
