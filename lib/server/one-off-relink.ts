import "server-only";
import { gunzipSync } from "node:zlib";
import {
  isSharedInbox,
  isSomeoneElse,
  lordFor,
  lordNamed,
  onParliamentDomain,
  politiciansIn,
  politiciansNamed,
  quotedAddresses,
  quotedNames,
  type PoliticianBook,
} from "@/lib/one-off";
import { parseMime, wholeTextOf } from "@/lib/email-parsing/mime";
import type { Relinked } from "@/lib/import-runs";
import { query, transaction } from "./db";
import { letterReply } from "./outside-services/blobs";
import { connectedAccounts, readPoliticianBook } from "@/lib/politicians/book";

// Relinking: whose each one-off thread is, worked out afresh from its
// messages' addresses, and the addresses and names they quote, against the
// politician book as it is now. Run after the nightly MP check, and when staff
// change a politician's addresses, as either can change whose a thread is.

/** How many blobs are read at once. */
const AT_ONCE = 10;

/** What a kept message quotes, from its blob: none if the blob has gone. */
export async function quotesOf(blobKey: string): Promise<{ addresses: string[]; names: string[] }> {
  const gzipped = await letterReply(blobKey);
  if (!gzipped) return { addresses: [], names: [] };
  const text = wholeTextOf(parseMime(gunzipSync(gzipped).toString("latin1")));
  return { addresses: quotedAddresses(text), names: quotedNames(text) };
}

/**
 * Reads the quotes of messages kept before they were stored, oldest first,
 * until `until` (a time from Date.now()); gives how many it read and how many
 * are left.
 */
async function readQuotes(until: number): Promise<{ read: number; unread: number }> {
  const rows = await query<{ id: number; blobKey: string }>(
    `SELECT id::int AS id, blob_key AS "blobKey" FROM one_off_messages WHERE quoted_addresses IS NULL ORDER BY id`,
  );
  let next = 0;
  let read = 0;
  async function worker() {
    while (next < rows.length && Date.now() < until) {
      const { id, blobKey } = rows[next++];
      const quotes = await quotesOf(blobKey);
      await query("UPDATE one_off_messages SET quoted_addresses = $2, quoted_names = $3 WHERE id = $1", [
        id,
        quotes.addresses,
        quotes.names,
      ]);
      read++;
    }
  }
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
  return { read, unread: rows.length - read };
}

type Message = { thread: number; addresses: string[]; quoted: string[] | null; names: string[] | null };

/** Each thread's people by the book: from every address on or quoted in its messages, and every name quoted. */
function threadPeople(book: PoliticianBook, messages: Message[]): Map<number, Set<number>> {
  const people = new Map<number, Set<number>>();
  for (const message of messages) {
    const found = [
      ...politiciansIn(book, [...message.addresses, ...(message.quoted ?? [])]).people,
      ...politiciansNamed(book, message.names ?? []),
    ];
    const thread = people.get(message.thread) ?? new Set();
    people.set(message.thread, thread);
    for (const id of found) thread.add(id);
  }
  return people;
}

/** An address that reads as a person's own: first.last, as Parliament gives its staff, not a service's. */
const PERSONAL = /^[a-z]+(?:[-'][a-z]+)*\.[a-z]+(?:[-'][a-z]+)*\d*@/;

/**
 * The offices' addresses: each parliament address that's a person's own but
 * no politician's, seen in threads with people that all have the same one,
 * by whose it is.
 */
function officeAddresses(
  book: PoliticianBook,
  messages: Message[],
  people: Map<number, Set<number>>,
): Map<string, number> {
  const seen = new Map<string, Set<number>>();
  for (const message of messages) {
    const ids = people.get(message.thread)!;
    if (ids.size === 0) continue;
    for (const address of [...message.addresses, ...(message.quoted ?? [])]) {
      if (!onParliamentDomain(address) || !PERSONAL.test(address) || politiciansIn(book, [address]).people.length)
        continue;
      const whose = seen.get(address) ?? new Set();
      seen.set(address, whose);
      for (const id of ids) whose.add(id);
    }
  }
  return new Map([...seen].filter(([, ids]) => ids.size === 1).map(([address, ids]) => [address, [...ids][0]]));
}

/**
 * Each thread through the House of Lords' shared inbox whose subject names
 * the Lord it's for (lordFor), by that Lord, when they're one of the sitting
 * Lords; one that names no one, or more than one, isn't anyone's by this.
 */
function sharedInboxLords(
  messages: Message[],
  subjects: { thread: number; subject: string }[],
  lords: { id: number; name: string }[],
): Map<number, number> {
  const shared = new Set(
    messages.filter((message) => message.addresses.some(isSharedInbox)).map((message) => message.thread),
  );
  return new Map(
    subjects.flatMap(({ thread, subject }) => {
      const name = shared.has(thread) ? lordFor(subject) : null;
      const id = name === null ? null : lordNamed(lords, name);
      return id === null ? [] : [[thread, id] as const];
    }),
  );
}

/**
 * Relinks every one-off thread: reads what it can of the quotes not yet
 * stored, until `until`; finds the offices' addresses, by the book without
 * them, but for those staff rejected; and links each thread to the people
 * the whole book finds in it. A thread with a message whose quotes are still
 * unread gains people but loses none, as what it quotes may be why it has
 * them. Whether each thread has someone else in it (`someone_else`) is worked
 * out again from its senders, as the book says who's a politician. A
 * thread through the Lords' shared inbox is the Lord's its subject names too.
 */
export async function relinkOneOffs(until: number): Promise<Relinked> {
  const { read, unread } = await readQuotes(until);
  const [direct, rows, linked, rejected, connected, subjects, lords] = await Promise.all([
    readPoliticianBook(false),
    query<Message & { from: string }>(
      `SELECT thread_id::int AS thread, from_address AS from, addresses, quoted_addresses AS quoted, quoted_names AS names
       FROM one_off_messages`,
    ),
    query<{ thread: number; id: number }>(
      `SELECT thread_id::int AS thread, notable_person_id::int AS id FROM one_off_thread_people`,
    ),
    query<{ address: string; id: number }>(
      "SELECT address, notable_person_id::int AS id FROM politician_addresses WHERE source = 'rejected'",
    ),
    connectedAccounts(),
    query<{ thread: number; subject: string }>("SELECT id::int AS thread, subject FROM one_off_threads"),
    query<{ id: number; name: string }>(
      `SELECT n.id::int AS id, n.name FROM notable_people n JOIN politicians p ON p.id = n.id
       WHERE p.house = 'lords' AND n.status = 'in_office'`,
    ),
  ]);
  const notTheirs = new Set(rejected.map(({ address, id }) => `${address} ${id}`));
  const offices = new Map(
    [...officeAddresses(direct, rows, threadPeople(direct, rows))].filter(
      ([address, id]) => !notTheirs.has(`${address} ${id}`),
    ),
  );
  const book: PoliticianBook = { ...direct, addresses: new Map(direct.addresses) };
  for (const [address, id] of offices) book.addresses.set(address, [...(book.addresses.get(address) ?? []), id]);
  const people = threadPeople(book, rows);
  // Every thread with a message has its set of people, if an empty one.
  for (const [thread, id] of sharedInboxLords(rows, subjects, lords)) people.get(thread)!.add(id);
  const unreadThreads = new Set(rows.filter((row) => row.quoted === null).map((row) => row.thread));
  const had = new Set(linked.map(({ thread, id }) => `${thread} ${id}`));
  const add = [...people].flatMap(([thread, ids]) =>
    [...ids].filter((id) => !had.has(`${thread} ${id}`)).map((id) => [thread, id]),
  );
  const remove = linked
    .filter(({ thread, id }) => !unreadThreads.has(thread) && !people.get(thread)?.has(id))
    .map(({ thread, id }) => [thread, id]);
  const someoneElse = [
    ...new Set(rows.filter((row) => isSomeoneElse(book, row.from, connected)).map((row) => row.thread)),
  ];
  await transaction(async (db) => {
    await query("UPDATE one_off_threads SET someone_else = (id = ANY($1::bigint[]))", [someoneElse], db);
    await query("DELETE FROM politician_addresses WHERE source = 'office'", [], db);
    await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source)
       SELECT address, id, 'office' FROM unnest($1::text[], $2::bigint[]) AS o (address, id)`,
      [[...offices.keys()], [...offices.values()]],
      db,
    );
    await query(
      `DELETE FROM one_off_thread_people WHERE (thread_id, notable_person_id) IN
         (SELECT * FROM unnest($1::bigint[], $2::bigint[]))`,
      [remove.map(([thread]) => thread), remove.map(([, id]) => id)],
      db,
    );
    await query(
      `INSERT INTO one_off_thread_people (thread_id, notable_person_id)
       SELECT * FROM unnest($1::bigint[], $2::bigint[]) ON CONFLICT DO NOTHING`,
      [add.map(([thread]) => thread), add.map(([, id]) => id)],
      db,
    );
  });
  return { read, unread, linked: add.length, unlinked: remove.length, offices: offices.size };
}
