import "server-only";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction } from "@/lib/server/db.server";
import { gmailAccess } from "@/lib/accounts/gmail-accounts.server";
import { lettersInbox } from "@/lib/server/letters-inbox.server";
import { deleteLetterReply } from "@/lib/server/outside-services/blobs.server";
import { trashGmailMessage } from "@/lib/server/outside-services/gmail.server";
import { deleteOneOffBlobs, eraseOneOffs, eraseRepliesToFormLetters } from "@/lib/server/one-off-emails.server";
import { eraseFromSavedFilters } from "@/lib/server/saved-filters.server";
import { refreshSupportersList } from "@/lib/supporters/facts.server";
import { problem } from "@/lib/server/problems.server";
import type { EraseLeftover } from "@/lib/staff-search";
import { erasureCopy } from "./copy";

// Erasing a supporter, when they ask to be forgotten: for each source,
// what that source holds about them goes. A form entry goes with its letter,
// the letter's events and the copies of replies forwarded to the sender; a
// letter from the letters inbox with its sender's proxy, its draft, every
// message kept both ways and their blobs, and its mail there goes to
// Trash; a Luma user goes with their registrations and contact, and their
// Luma ID is kept in
// luma_erased so the import never copies them back; their CiviCRM contacts go
// the same way, their IDs kept in civicrm_erased; a message of a mailing
// sent to them loses its address and merge values; a one-off email with their
// address on it goes, with its blob, its IDs kept in one_off_erased so that
// reading its thread again doesn't keep it again, as does a reply on a form letter
// read from a staff mailbox; staff's notes on them go with their row; their
// details come out of saved filters. What stays is what
// exists to stop us mailing the address: email_problems, email_blocks and
// opt_outs. The audit log entry carries the supporter's ID and the
// request's reference, never a name or address. Luma's own copy is left
// for a person to deal with, as is Global's CiviCRM of a member
// (docs/data-protection.md).

export type ErasureResult = {
  lumaUsers: number;
  formEntries: number;
  letters: number;
  /** Their CiviCRM contacts. */
  members: number;
  /** Their proxies on the letters inbox, and the messages of their letters there, trashed. */
  proxies: number;
  messages: number;
  /** One-off emails with their address on, deleted. */
  oneOffs: number;
  /** What couldn't be cleared afterwards: the erasure itself is done. */
  notCleared: EraseLeftover[];
};

/** Erases supporter `id`, as `by`, under the request's `reference`. Undefined if there's no such supporter. */
export async function eraseSupporter(id: number, reference: string, by: string): Promise<ErasureResult | undefined> {
  return transaction(async (db) => {
    const [supporter] = await query("SELECT 1 FROM supporters WHERE id = $1 FOR UPDATE", [id], db);
    if (!supporter) return undefined;
    await eraseFromSavedFilters(id, by, db);
    // First, while their links say which addresses and numbers are theirs: their replies to broadcasts, with our
    // answers to them, whose messages go after, a text's kept only here; their links and yeses on the contact
    // preferences page; what CiviCRM has answered of what we sent it for them; and that a number of theirs isn't on
    // WhatsApp. Not an opt-out, nor one still to go, which stay.
    const theirs = `(SELECT lower(matched_value) FROM supporter_links WHERE supporter_id = $1
                     UNION SELECT phone_number(matched_value) FROM supporter_links WHERE supporter_id = $1)`;
    const replies = await query<{ blobKey: string }>(
      `WITH gone AS (
         DELETE FROM broadcast_replies WHERE message_id IN (SELECT id FROM broadcast_messages WHERE supporter_id = $1)
         RETURNING blob_key)
       SELECT blob_key AS "blobKey" FROM gone WHERE blob_key IS NOT NULL`,
      [id],
      db,
    );
    await query(`DELETE FROM preference_links WHERE address IN ${theirs}`, [id], db);
    await query(`DELETE FROM preference_choices WHERE address IN ${theirs}`, [id], db);
    await query(
      `DELETE FROM civicrm_updates WHERE status IS NOT NULL AND (email IN ${theirs} OR phone IN ${theirs})`,
      [id],
      db,
    );
    await query(`DELETE FROM whatsapp_unreachable WHERE number IN ${theirs}`, [id], db);
    const lumaUsers = (
      await query<{ userId: string }>(
        `SELECT luma_user_id AS "userId" FROM supporter_links WHERE supporter_id = $1 AND luma_user_id IS NOT NULL`,
        [id],
        db,
      )
    ).map((row) => row.userId);
    const entries = (
      await query<{ id: number }>(
        "SELECT form_entry_id::int AS id FROM supporter_links WHERE supporter_id = $1 AND form_entry_id IS NOT NULL",
        [id],
        db,
      )
    ).map((row) => row.id);
    const proxyIds = (
      await query<{ id: number }>(
        `SELECT DISTINCT proxy_id::int AS id FROM letters_from_supporters WHERE entry_id = ANY($1::bigint[]) AND proxy_id IS NOT NULL`,
        [entries],
        db,
      )
    ).map((row) => row.id);
    // The letters inbox's mail of their letters, every message both ways and what we sent, to trash after.
    const mail = await query<{ blobKey: string | null; gmailId: string }>(
      `SELECT r.blob_key AS "blobKey", r.gmail_message_id AS "gmailId" FROM letter_replies r
         JOIN letters_from_supporters s ON s.id = r.letter_id
       WHERE s.entry_id = ANY($1::bigint[]) AND s.proxy_id IS NOT NULL
       UNION ALL SELECT NULL, e.message_id FROM email_sends e JOIN letters_from_supporters s ON s.id = e.letter_id
       WHERE s.entry_id = ANY($1::bigint[]) AND s.proxy_id IS NOT NULL AND e.outcome = 'sent' AND e.backend = 'gmail'`,
      [entries],
      db,
    );
    // A letter's row stays, as a record it went to that MP, without what could say who wrote it.
    await query(
      `UPDATE email_sends SET from_address = NULL, subject = NULL
       WHERE letter_id IN (SELECT id FROM letters_from_supporters WHERE entry_id = ANY($1::bigint[]))`,
      [entries],
      db,
    );
    const oneOffs = await eraseOneOffs(id, db);
    const formLetterReplies = await eraseRepliesToFormLetters(entries, db);
    await query(
      `DELETE FROM email_sends WHERE purpose IN ('letter-copy', 'relay', 'supporter-notice')
       AND letter_id IN (SELECT id FROM letters_from_supporters WHERE entry_id = ANY($1::bigint[]))`,
      [entries],
      db,
    );
    const letters = await query<{ id: number }>(
      `DELETE FROM letters WHERE id IN (SELECT id FROM letters_from_supporters WHERE entry_id = ANY($1::bigint[])) RETURNING id::int AS id`,
      [entries],
      db,
    );
    await query("DELETE FROM form_entries WHERE id = ANY($1::bigint[])", [entries], db);
    // Their proxies: mail to one now is not understood.
    const proxies = await query("DELETE FROM proxies WHERE id = ANY($1::bigint[]) RETURNING id", [proxyIds], db);
    await query(
      `DELETE FROM email_sends WHERE purpose = 'forwarded-reply' AND letter_id IS NULL
       AND address IN (SELECT lower(matched_value) FROM supporter_links WHERE supporter_id = $1)`,
      [id],
      db,
    );
    // What we emailed them ourselves, by address or as a broadcast's copy, isn't kept in the log of sends.
    await query(
      `DELETE FROM email_sends WHERE purpose IN ('broadcast', 'preferences-link', 'bulk-notice', 'broadcast-answer')
       AND (address IN (SELECT lower(matched_value) FROM supporter_links WHERE supporter_id = $1)
         OR broadcast_message_id IN (SELECT id FROM broadcast_messages WHERE supporter_id = $1))`,
      [id],
      db,
    );
    // Their CiviCRM contacts, linked or by any of their addresses, kept in civicrm_erased.
    const members = await query(
      `WITH theirs AS (
         DELETE FROM civicrm_contacts c
         WHERE c.contact_id IN (SELECT civicrm_contact_id FROM supporter_links WHERE supporter_id = $1)
           OR c.email IN (SELECT lower(matched_value) FROM supporter_links WHERE supporter_id = $1)
         RETURNING contact_id),
       kept AS (INSERT INTO civicrm_erased (contact_id) SELECT contact_id FROM theirs ON CONFLICT DO NOTHING)
       SELECT contact_id FROM theirs`,
      [id],
      db,
    );
    await query("INSERT INTO luma_erased (user_id) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING", [lumaUsers], db);
    await query("DELETE FROM luma_people WHERE user_id = ANY($1::text[])", [lumaUsers], db);
    // A message they were sent keeps only that it was; one still to go won't, as they've no permission now.
    await query(
      `UPDATE broadcast_messages SET supporter_id = NULL, address = NULL, merge_values = NULL,
         status = CASE status WHEN 'scheduled' THEN 'skipped' ELSE status END,
         skip_reason = CASE status WHEN 'scheduled' THEN 'no-permission' ELSE skip_reason END
       WHERE supporter_id = $1`,
      [id],
      db,
    );
    await query("DELETE FROM supporters WHERE id = $1", [id], db);
    // Off the list now, not at the next import.
    await refreshSupportersList(db);
    const result: Omit<ErasureResult, "notCleared"> = {
      lumaUsers: lumaUsers.length,
      formEntries: entries.length,
      letters: letters.length,
      members: members.length,
      proxies: proxies.length,
      messages: mail.length,
      oneOffs: oneOffs.length,
    };
    await logChange(by, "erase supporter", { id, reference, ...result }, db);
    return { result, mail, blobs: [...oneOffs, ...formLetterReplies], replies: replies.map((row) => row.blobKey) };
  }).then(async (erased) => {
    if (!erased) return undefined;
    const notCleared = [
      ...(await leftOver("mail", () => clearMail(erased.mail))),
      ...(await leftOver("oneOffs", () => deleteOneOffBlobs(erased.blobs))),
      ...(await leftOver("replies", async () => {
        for (const key of erased.replies) await deleteLetterReply(key);
      })),
    ];
    return { ...erased.result, notCleared };
  });
}

/**
 * Does a clean-up after an erasure. A failure is reported, not thrown, and
 * named for whoever erased: the erasure itself is done.
 */
async function leftOver(what: EraseLeftover, clear: () => Promise<void>): Promise<EraseLeftover[]> {
  try {
    await clear();
    return [];
  } catch (error) {
    problem(`${erasureCopy.erase.partly} ${erasureCopy.erase.notCleared[what]}`, error);
    return [what];
  }
}

/**
 * Deletes the kept messages of erased letters from Netlify Blobs, and
 * moves them and what we sent in the letters inbox to Trash, which Gmail
 * empties after 30 days.
 */
async function clearMail(mail: { blobKey: string | null; gmailId: string }[]): Promise<void> {
  if (!mail.length) return;
  for (const { blobKey } of mail) if (blobKey) await deleteLetterReply(blobKey);
  const token = await gmailAccess(lettersInbox()!);
  for (const { gmailId } of mail) await trashGmailMessage(token, gmailId);
}
