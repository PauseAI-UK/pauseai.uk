import { query } from "@/lib/server/db";

// A politician's messages, straight into the tables: the replies kept on a
// letter's thread, and one-off threads and their messages.

/** Adds a message kept on a letter's thread, by its Gmail ID: from the politician's side unless `us` or `supporter`. */
export async function addTestReply(
  letterId: number,
  id: string,
  fields: { from: string; name?: string; us?: boolean; supporter?: boolean },
): Promise<void> {
  await query(
    `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, from_name, at, from_us, from_supporter, blob_key, size)
     VALUES ($1, 'policy@pauseai.uk', $2, 't', $3, $4, '2026-10-01T09:00:00Z', $5, $6, $2, 1)`,
    [letterId, id, fields.from, fields.name ?? "", fields.us ?? false, fields.supporter ?? false],
  );
}

/** Adds a one-off thread with these politicians on it, and returns its ID. */
export async function addTestThread(politicians: number[], subject: string, someoneElse: boolean): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    "INSERT INTO one_off_threads (subject, someone_else, latest_at) VALUES ($1, $2, now()) RETURNING id::int AS id",
    [subject, someoneElse],
  );
  await query("INSERT INTO one_off_thread_people (thread_id, notable_person_id) SELECT $1, unnest($2::bigint[])", [
    id,
    politicians,
  ]);
  return id;
}

/** Adds a message to a one-off thread, by its Gmail ID. */
export async function addTestMessage(
  thread: number,
  id: string,
  from: string,
  fields: { name?: string; us?: boolean; subject?: string; at?: string } = {},
): Promise<void> {
  await query(
    `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, from_address, from_name, addresses, subject, at, from_us, blob_key, size)
     VALUES ($1, 'policy@pauseai.uk', $2, 't', $3, $4, ARRAY[$3], $5, $7, $6, $2, 1)`,
    [
      thread,
      id,
      from,
      fields.name ?? "",
      fields.subject ?? "A thread",
      fields.us ?? false,
      fields.at ?? "2026-10-02T09:00:00Z",
    ],
  );
}
