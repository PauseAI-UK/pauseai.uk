import "server-only";
import { listAsks, type Ask } from "@/lib/asks/records.server";
import { campaignBySlug, unpublishable, type CampaignLetter, type UnpublishableReason } from "@/lib/email-your-mp";
import { checkMailingDoc, greetingLetter, type MailingDoc, type MailingRecipientValues } from "./doc";
import type { SaveResult } from "./drafts.server";
import type { MailingChoice } from "./fields";
import { answerChoices } from "./recipients.server";
import { mailingPoliticians } from "@/lib/politicians/records.server";
import { query, transaction, type Queryable } from "@/lib/server/db.server";

// Each campaign's letter, as staff write it (campaign_letters): the
// versions published, the latest of which supporters start from, and the
// draft staff are working on. Publishing stamps the draft, which the
// database then keeps from changing.

/** A version, published or the draft, as the staff pages show it. */
export type CampaignLetterRow = CampaignLetter & {
  campaign: string;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
};

const COLUMNS = `id::int AS id, campaign, subject, body, version, updated_at AS "updatedAt", updated_by AS "updatedBy",
  published_at AS "publishedAt", published_by AS "publishedBy"`;

function checked(row: CampaignLetterRow): CampaignLetterRow {
  return { ...row, body: checkMailingDoc(row.body)! };
}

/** The version supporters start from: the campaign's latest published; null before its first. */
export async function publishedLetter(campaign: string): Promise<CampaignLetter | null> {
  const [row] = await query<CampaignLetterRow>(
    `SELECT ${COLUMNS} FROM campaign_letters WHERE campaign = $1 AND published_at IS NOT NULL
     ORDER BY published_at DESC, id DESC LIMIT 1`,
    [campaign],
  );
  return row ? { id: row.id, subject: row.subject, body: checkMailingDoc(row.body)! } : null;
}

/** A published version of the campaign's letter, by its ID; none for a draft, or another campaign's. */
export async function publishedVersion(campaign: string, id: number): Promise<CampaignLetter | undefined> {
  const [row] = await query<CampaignLetterRow>(
    `SELECT ${COLUMNS} FROM campaign_letters WHERE id = $1 AND campaign = $2 AND published_at IS NOT NULL`,
    [id, campaign],
  );
  return row && { id: row.id, subject: row.subject, body: checkMailingDoc(row.body)! };
}

/** A published version, with how many letters started from it. */
export type PublishedVersion = CampaignLetterRow & { letters: number };

/**
 * The campaign's published versions, newest first, each with its letters;
 * and how many of its letters are from before there were versions.
 */
export async function publishedVersions(campaign: string): Promise<{ versions: PublishedVersion[]; before: number }> {
  const [versions, [{ before }]] = await Promise.all([
    query<PublishedVersion>(
      `SELECT ${COLUMNS},
         (SELECT count(*)::int FROM letters_from_supporters s WHERE s.campaign_letter_id = campaign_letters.id) AS letters
       FROM campaign_letters WHERE campaign = $1 AND published_at IS NOT NULL
       ORDER BY published_at DESC, id DESC`,
      [campaign],
    ),
    query<{ before: number }>(
      "SELECT count(*)::int AS before FROM letters_from_supporters WHERE campaign = $1 AND campaign_letter_id IS NULL",
      [campaign],
    ),
  ]);
  return { versions: versions.map((row) => ({ ...row, body: checkMailingDoc(row.body)! })), before };
}

/** Whether a campaign in the code has a draft open; for one not in the code, whose letter isn't staff's, undefined. */
export async function hasDraft(campaign: string): Promise<boolean | undefined> {
  if (!campaignBySlug(campaign)) return undefined;
  return (await campaignDraft(campaign)) !== undefined;
}

/** The campaign's draft, if staff have one open. */
export async function campaignDraft(campaign: string): Promise<CampaignLetterRow | undefined> {
  const [row] = await query<CampaignLetterRow>(
    `SELECT ${COLUMNS} FROM campaign_letters WHERE campaign = $1 AND published_at IS NULL`,
    [campaign],
  );
  return row && checked(row);
}

/**
 * The campaign's draft, opened by `by` if there's none: a copy of the
 * latest version, or for a campaign with none, a letter to an MP to start
 * from, `greeting` and their salutation.
 */
export async function openDraft(campaign: string, by: string, greeting: string): Promise<CampaignLetterRow> {
  const latest = await publishedLetter(campaign);
  const start: { subject: string; body: MailingDoc } = latest ?? {
    subject: "",
    body: greetingLetter(greeting, "salutation"),
  };
  await query(
    `INSERT INTO campaign_letters (campaign, subject, body, updated_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (campaign) WHERE published_at IS NULL DO NOTHING`,
    [campaign, start.subject, JSON.stringify(start.body), by],
  );
  return (await campaignDraft(campaign))!;
}

/** What a save changes in a draft. */
export type CampaignLetterChanges = { subject?: string; body?: MailingDoc };

/** Why a change to the draft `id` at a version didn't happen: it's been published, discarded, or saved since. */
async function notSaved(id: number, db?: Queryable): Promise<SaveResult & { saved: false }> {
  const [row] = await query<{ published: boolean }>(
    `SELECT published_at IS NOT NULL AS published FROM campaign_letters WHERE id = $1`,
    [id],
    db,
  );
  return { saved: false, reason: !row ? "gone" : row.published ? "not-draft" : "conflict" };
}

/** Saves changes to the draft, if it's still at `version`: no one else has saved it since. */
export async function saveCampaignDraft(
  id: number,
  version: number,
  changes: CampaignLetterChanges,
  by: string,
): Promise<SaveResult> {
  const [row] = await query<{ version: number }>(
    `UPDATE campaign_letters SET subject = coalesce($3, subject), body = coalesce($4, body), version = version + 1,
       updated_at = now(), updated_by = $5
     WHERE id = $1 AND version = $2 AND published_at IS NULL RETURNING version`,
    [id, version, changes.subject ?? null, changes.body ? JSON.stringify(changes.body) : null, by],
  );
  return row ? { saved: true, version: row.version } : notSaved(id);
}

/**
 * Publishes the draft as it is at `version`, by `by`: from then on it's
 * the version supporters start from, and never changes.
 */
export async function publishCampaignDraft(
  id: number,
  version: number,
  by: string,
): Promise<SaveResult | { saved: false; reason: UnpublishableReason }> {
  return transaction(async (db) => {
    // Locked, so no save comes between checking it and publishing it.
    const [draft] = await query<CampaignLetterRow>(
      `SELECT ${COLUMNS} FROM campaign_letters WHERE id = $1 AND version = $2 AND published_at IS NULL FOR UPDATE`,
      [id, version],
      db,
    );
    if (!draft) return notSaved(id, db);
    const reason = unpublishable(checked(draft));
    if (reason) return { saved: false, reason };
    await query("UPDATE campaign_letters SET published_at = now(), published_by = $2 WHERE id = $1", [id, by], db);
    return { saved: true, version };
  });
}

/** Throws the draft away; whether there was one to. A published version is never deleted. */
export async function discardCampaignDraft(id: number): Promise<boolean> {
  const rows = await query("DELETE FROM campaign_letters WHERE id = $1 AND published_at IS NULL RETURNING id", [id]);
  return rows.length > 0;
}

/** What saving a draft can change, as the writer sends it; undefined for anything else. */
export function campaignLetterChangesFrom(value: unknown): CampaignLetterChanges | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const changes: CampaignLetterChanges = {};
  for (const [name, one] of Object.entries(value)) {
    if (name === "subject" && typeof one === "string") changes.subject = one;
    else if (name === "body" && checkMailingDoc(one)) changes.body = checkMailingDoc(one);
    else return undefined;
  }
  return changes;
}

/**
 * An MP the preview can show the draft for, with their values but the
 * sender's, whom the site can't know until they write: the MP's
 * salutation, name and constituency, and their answers to the asks.
 */
export type PreviewMp = MailingRecipientValues & { id: number; name: string; constituency: string | null };

/** What writing a campaign's letter needs: every MP in office, test ones too, and the asks a part can be for. */
export async function campaignWriterData(): Promise<{ mps: PreviewMp[]; asks: Ask[]; conditions: MailingChoice[] }> {
  const [found, asks] = await Promise.all([mailingPoliticians({ house: "commons", status: "in_office" }), listAsks()]);
  const mps = found.map((mp) => ({
    id: mp.id,
    name: mp.name,
    constituency: mp.constituency,
    values: { salutation: mp.salutation, name: mp.name, constituency: mp.constituency ?? "" },
    meets: mp.answers,
  }));
  return { mps, asks, conditions: answerChoices(asks, mps) };
}
