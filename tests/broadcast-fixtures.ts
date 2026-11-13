import { query } from "@/lib/server/db";
import { getWrittenBroadcast } from "@/lib/server/broadcast-drafts";
import { supporterAudience } from "@/lib/server/broadcast-recipients";
import { refreshSupportersList } from "@/lib/server/supporter-facts";
import { linkSupporters } from "@/lib/server/supporters";

// Supporters for the tests of broadcasts: each a Luma guest of one event, so
// following the calendar says yes to emails about it, and a number given says
// yes to its texts.

export const EVENT_WORDS = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      content: [
        { type: "text" as const, text: "Hi " },
        { type: "field" as const, attrs: { field: "firstName" } },
        { type: "text" as const, text: ", see you there." },
      ],
    },
  ],
};

/** A supporter who follows the calendar, by their Luma ID; returns their ID. */
export async function addFollower(
  id: string,
  email: string,
  name: string,
  more: { phone?: string; postcode?: string } = {},
): Promise<number> {
  await query("INSERT INTO luma_people (user_id, email, name, contact_since) VALUES ($1, $2, $3, $4)", [
    id,
    email,
    name,
    "2026-09-01T00:00:00Z",
  ]);
  await query(
    `INSERT INTO luma_events (id, name, url, start_at, access, city, latitude, longitude)
     VALUES ('evt-1', 'evt-1', 'evt-1', '2026-10-01T18:00:00Z', 'manage', 'Manchester', 53.48, -2.24) ON CONFLICT DO NOTHING`,
  );
  await query(
    `INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at, phone, postcode)
     VALUES ($1, 'evt-1', $2, 'approved', '2026-09-20T10:00:00Z', $3, $4)`,
    [`gst-${id}`, id, more.phone ?? null, more.postcode ?? null],
  );
  await linkSupporters();
  await refreshSupportersList();
  const [{ supporter }] = await query<{ supporter: number }>(
    "SELECT supporter_id::int AS supporter FROM supporter_links WHERE luma_user_id = $1",
    [id],
  );
  return supporter;
}

/** A template in `status`, with these words; returns its ID. */
export async function addTemplate(
  name: string,
  more: { status?: string; createdBy?: string | null; reason?: string } = {},
): Promise<number> {
  const status = more.status ?? "approved";
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO whatsapp_templates (name, body, status, created_by, approved_at, rejected_at, rejected_reason, stopped_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $3 IN ('paused', 'disabled') THEN now() END) RETURNING id::int AS id`,
    [
      name,
      JSON.stringify(EVENT_WORDS),
      status,
      more.createdBy === undefined ? "jo@pauseai.uk" : more.createdBy,
      status === "approved" ? "2026-10-01T10:00:00Z" : null,
      status === "rejected" ? "2026-10-02T10:00:00Z" : null,
      status === "rejected" ? (more.reason ?? "It ends with a merge field.") : null,
    ],
  );
  return id;
}

/**
 * Sets scheduled broadcast `id` going, `state`, with a message to each
 * recipient its filters find, not yet sent, as sending will make them.
 */
export async function startSending(id: number, state: "sending" | "sent" = "sending"): Promise<void> {
  const broadcast = (await getWrittenBroadcast(id))!;
  for (const r of (await supporterAudience(broadcast.filter, broadcast)).recipients) {
    await query(
      `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, merge_values)
       VALUES ($1, $2, $3, 'scheduled', $4)`,
      [id, r.id, r.address, JSON.stringify({ name: r.name, place: r.place, values: r.values, meets: r.meets })],
    );
  }
  await query("UPDATE mailings SET state = $2 WHERE id = $1", [id, state]);
}
