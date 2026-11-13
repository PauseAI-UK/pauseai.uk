import "server-only";
import { query } from "./db";
import { letterReply } from "./outside-services/blobs";

// Every message the site keeps whole, gzipped, in Netlify Blobs, outside the
// database: the replies to our letters, one-off emails, and replies to
// broadcasts by email. Each night the backup's container archives them all
// (backup/container/messages.ts), through the read-only route
// app/api/backup/messages. A message erased or deleted here is in no archive
// after, and the archives expire, as the dumps do.

/** Each message's key, once, as a row of `key`. */
const KEYS = `SELECT blob_key AS key FROM letter_replies
  UNION SELECT blob_key FROM one_off_messages
  UNION SELECT blob_key FROM broadcast_replies WHERE blob_key IS NOT NULL`;

/** Every kept message's key, in order. */
export async function keptMessageKeys(): Promise<string[]> {
  const rows = await query<{ key: string }>(`SELECT key FROM (${KEYS}) k ORDER BY key`);
  return rows.map((row) => row.key);
}

/** A kept message, gzipped, by its key; undefined for a key no row has, or whose message is gone. */
export async function keptMessage(key: string): Promise<Buffer | undefined> {
  const [row] = await query(`SELECT 1 FROM (${KEYS}) k WHERE key = $1`, [key]);
  return row ? letterReply(key) : undefined;
}
