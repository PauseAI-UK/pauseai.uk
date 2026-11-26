import { query } from "@/lib/server/db.server";
import { getWrittenBroadcast } from "@/lib/broadcasts/drafts.server";
import { supporterAudience } from "@/lib/broadcasts/recipients.server";
import { refreshSupportersList } from "@/lib/supporters/facts.server";
import { linkSupporters } from "@/lib/supporters/records.server";
import { phoneNumber } from "@/lib/phone";

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

/**
 * A supporter who follows the calendar, by their Luma ID, with a number as
 * they typed it, which is kept in international format as Luma's import
 * keeps it; returns their ID.
 */
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
    [`gst-${id}`, id, more.phone ? phoneNumber(more.phone) : null, more.postcode ?? null],
  );
  await linkSupporters();
  await refreshSupportersList();
  const [{ supporter }] = await query<{ supporter: number }>(
    "SELECT supporter_id::int AS supporter FROM supporter_links WHERE luma_user_id = $1",
    [id],
  );
  return supporter;
}

/** What a variant made for a test may say of itself: its state, who made it, why it was rejected, and its words, header kind and buttons. */
type VariantMore = {
  status?: string;
  createdBy?: string | null;
  reason?: string;
  body?: object;
  header?: "location" | "image" | null;
  buttons?: { text: string; url?: string }[];
};

/** A template variant in `status`, with these words, or the event's; returns its ID. */
export async function addVariant(name: string, more: VariantMore = {}): Promise<number> {
  const status = more.status ?? "approved";
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO whatsapp_template_variants (name, body, status, created_by, approved_at, rejected_at, rejected_reason,
       stopped_at, header, buttons)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $3 IN ('paused', 'disabled') THEN now() END, $8, $9)
     RETURNING id::int AS id`,
    [
      name,
      JSON.stringify(more.body ?? EVENT_WORDS),
      status,
      more.createdBy === undefined ? "jo@pauseai.uk" : more.createdBy,
      status === "approved" ? "2026-10-01T10:00:00Z" : null,
      status === "rejected" ? "2026-10-02T10:00:00Z" : null,
      status === "rejected" ? (more.reason ?? "INVALID_FORMAT") : null,
      more.header ?? null,
      JSON.stringify(more.buttons ?? []),
    ],
  );
  return id;
}

/**
 * A template of one variant, in `status`, with these words; or of two,
 * with `conditional`'s for those who meet `condition`. Returns its ID.
 */
export async function addTemplate(
  name: string,
  more: VariantMore & { condition?: string; conditional?: VariantMore } = {},
): Promise<number> {
  const { condition, conditional, ...first } = more;
  const one = await addVariant(name, first);
  const other = conditional ? await addVariant(`${name}, for some`, conditional) : null;
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO whatsapp_templates (name, condition, default_variant_id, conditional_variant_id, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id`,
    [name, other ? condition : null, one, other, more.createdBy === undefined ? "jo@pauseai.uk" : more.createdBy],
  );
  return id;
}

/** The variants template `id` has: its default one's ID, and its conditional one's, if it has one. */
export async function variantsOf(id: number): Promise<{ first: number; second: number | null }> {
  const [row] = await query<{ first: number; second: number | null }>(
    `SELECT default_variant_id::int AS first, conditional_variant_id::int AS second FROM whatsapp_templates WHERE id = $1`,
    [id],
  );
  return row;
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
