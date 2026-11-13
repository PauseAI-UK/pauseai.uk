import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { open } from "node:fs/promises";

// The messages the site keeps whole outside the database, in Netlify Blobs:
// each night the container writes every one into one tar file, each gzipped
// as the site keeps it, under its key: from last night's archive, which the
// Worker sends it, where that has it, as a key's message never changes; the
// rest through the site's read-only route (app/api/backup/messages). The Worker stores it beside
// the dump, and it expires as the dumps do, so a message erased on the site
// leaves the backups with them.

export interface MessagesReport {
  bytes: number;
  sha256: string;
  /** How many messages are in the archive. */
  messages: number;
  /** How many came from the site, not last night's archive. */
  fetched: number;
  /** The keys the site listed but had no message for. */
  missing: string[];
  /** Why last night's archive, sent to copy from, couldn't be used, if it couldn't. */
  previousUnused?: string;
}

/** Asks the site, with a path, as fetch does, with the backup's secret. */
export type Site = (path: string) => Promise<Response>;

const BLOCK = 512;
const EMPTY = Buffer.alloc(BLOCK);

/** How many messages are fetched at once: few, as Netlify drops some of a quick burst. */
const AT_ONCE = 4;

/** How many messages between the lines saying how far it's got: a whole number of batches. */
const PROGRESS_EVERY = 100;

/** A tar header field: `text`, padded with NULs to `length`. */
function field(header: Buffer, offset: number, length: number, text: string): void {
  header.write(text, offset, length, "utf8");
}

/** A number as tar writes it: octal, zero-padded, then a NUL. */
const octal = (n: number, length: number): string => `${n.toString(8).padStart(length - 1, "0")}\0`;

/**
 * A ustar header for a file of `size` bytes named `name`. A name too long
 * for its 100 bytes goes in two at a "/", the part before in its prefix.
 */
export function tarHeader(name: string, size: number, mtime: Date): Buffer {
  let [prefix, rest] = ["", name];
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf("/", 155);
    [prefix, rest] = [name.slice(0, cut), name.slice(cut + 1)];
    if (cut < 0 || Buffer.byteLength(prefix) > 155 || Buffer.byteLength(rest) > 100) {
      throw new Error(`A key too long for tar: ${name}`);
    }
  }
  const header = Buffer.alloc(BLOCK);
  field(header, 0, 100, rest);
  field(header, 100, 8, "0000644\0");
  field(header, 108, 8, octal(0, 8));
  field(header, 116, 8, octal(0, 8));
  field(header, 124, 12, octal(size, 12));
  field(header, 136, 12, octal(Math.floor(mtime.getTime() / 1000), 12));
  // The checksum is of the header with its own field as spaces.
  field(header, 148, 8, "        ");
  field(header, 156, 1, "0");
  field(header, 257, 6, "ustar\0");
  field(header, 263, 2, "00");
  field(header, 345, 155, prefix);
  let sum = 0;
  for (const byte of header) sum += byte;
  field(header, 148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

/** Where a message is in a tar file: its data's offset, and its size. */
type Entry = { offset: number; size: number };

/** A tar field as text, up to its first NUL. */
const text = (block: Buffer, offset: number, length: number): string =>
  block.toString("utf8", offset, offset + length).replace(/\0.*$/s, "");

/**
 * Where each file is in the tar file at `path`, by name, as tarHeader writes
 * them; empty if there's no file there. Throws on one it can't read, which
 * is then not used.
 */
export async function tarIndex(path: string): Promise<Map<string, Entry>> {
  const index = new Map<string, Entry>();
  let file;
  try {
    file = await open(path);
  } catch {
    return index;
  }
  try {
    const { size: length } = await file.stat();
    const block = Buffer.alloc(BLOCK);
    let at = 0;
    while (at + BLOCK <= length) {
      await file.read(block, 0, BLOCK, at);
      // An empty block ends it.
      if (block.equals(EMPTY)) return index;
      if (text(block, 257, 5) !== "ustar") throw new Error(`Not a tar header at byte ${at}.`);
      const prefix = text(block, 345, 155);
      const name = prefix ? `${prefix}/${text(block, 0, 100)}` : text(block, 0, 100);
      const size = parseInt(text(block, 124, 12), 8);
      if (at + BLOCK + size > length) throw new Error(`${name} runs past the end of the file.`);
      index.set(name, { offset: at + BLOCK, size });
      at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    }
    throw new Error("The file ends without the empty blocks that end a tar file.");
  } finally {
    await file.close();
  }
}

/** Waits `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The waits before each try after the first, doubling from a second up to a
 * minute, so a site that's busy or briefly down has a couple of minutes to
 * come back: a request is tried this many times and one more.
 */
const RETRY_WAITS = [1, 2, 4, 8, 16, 32, 60].map((seconds) => seconds * 1000);

/** An error in words, with what caused it, as fetch puts the network's reason in its cause: "fetch failed: ECONNRESET". */
export function why(error: unknown): string {
  const { message, cause } = error as Error & { cause?: { message?: string; code?: string } };
  const reason = cause && (cause.code ?? cause.message);
  return reason ? `${message}: ${reason}` : message;
}

/**
 * Asks the site for `path`, trying again after a wait when no answer
 * comes, or one that says to (a 5xx, or 429, too many at once); its
 * answer, or what went wrong the last time, in words.
 */
async function ask(site: Site, path: string, wait: (ms: number) => Promise<void>): Promise<Response> {
  for (let tried = 0; ; tried++) {
    let failure: string;
    try {
      const answer = await site(path);
      if (answer.status < 500 && answer.status !== 429) return answer;
      failure = `${answer.status}`;
    } catch (error) {
      failure = why(error);
    }
    if (tried === RETRY_WAITS.length) throw new Error(`${failure}, ${tried + 1} times`);
    await wait(RETRY_WAITS[tried]);
  }
}

/**
 * Writes every message the site lists into a tar file at `path`, each named
 * by its key, dated `at`: from last night's archive at `previous`, where it
 * has the key, as a key's message never changes; else from the site, a few
 * at once, each tried again if it fails. One the site lists that's in
 * neither is missing. Says how big the file is, its hash, how many it holds,
 * how many were fetched, which were missing, and why last night's couldn't
 * be used, if it couldn't. Throws if the site won't list them, or a send
 * fails but as missing.
 */
export async function archiveMessages(
  site: Site,
  path: string,
  at: Date,
  previous?: string,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<MessagesReport> {
  let listed: Response;
  try {
    listed = await ask(site, "/api/backup/messages", wait);
  } catch (error) {
    throw new Error(`The site wouldn't list its messages: ${(error as Error).message}.`);
  }
  if (!listed.ok) throw new Error(`The site wouldn't list its messages: ${listed.status}.`);
  const { keys } = (await listed.json()) as { keys: string[] };
  let index = new Map<string, Entry>();
  let unused: string | undefined;
  if (previous) {
    try {
      index = await tarIndex(previous);
    } catch (error) {
      unused = (error as Error).message;
    }
  }
  const old = previous && index.size ? await open(previous) : undefined;
  const out = createWriteStream(path);
  const hash = createHash("sha256");
  let bytes = 0;
  const write = async (chunk: Buffer) => {
    hash.update(chunk);
    bytes += chunk.length;
    if (!out.write(chunk)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
  };
  const missing: string[] = [];
  let fetched = 0;
  // How far it's got, in the container's logs, as fetching many takes minutes.
  const progress = (done: number) =>
    console.info(`Messages: ${done} of ${keys.length}, ${fetched} fetched from the site`);
  progress(0);
  // A message: from last night's archive, else the site; null where the site has none for its key.
  const one = async (key: string): Promise<Buffer | null> => {
    const entry = index.get(key);
    if (old && entry) {
      const data = Buffer.alloc(entry.size);
      await old.read(data, 0, entry.size, entry.offset);
      return data;
    }
    let file: Response;
    try {
      file = await ask(site, `/api/backup/messages?key=${encodeURIComponent(key)}`, wait);
    } catch (error) {
      throw new Error(`The site wouldn't send message ${key}: ${(error as Error).message}.`);
    }
    if (file.status === 404) return null;
    if (!file.ok) throw new Error(`The site wouldn't send message ${key}: ${file.status}.`);
    fetched++;
    return Buffer.from(await file.arrayBuffer());
  };
  try {
    // A few at once, each batch written in the order listed.
    for (let i = 0; i < keys.length; i += AT_ONCE) {
      if (i > 0 && i % PROGRESS_EVERY === 0) progress(i);
      const batch = keys.slice(i, i + AT_ONCE);
      const files = await Promise.all(batch.map(one));
      for (const [j, data] of files.entries()) {
        if (!data) {
          missing.push(batch[j]);
          continue;
        }
        await write(tarHeader(batch[j], data.length, at));
        await write(data);
        await write(Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
      }
    }
    // Two empty blocks end the archive.
    await write(Buffer.alloc(BLOCK * 2));
    progress(keys.length);
  } finally {
    await new Promise<void>((resolve) => out.end(() => resolve()));
    await old?.close();
  }
  return {
    bytes,
    sha256: hash.digest("hex"),
    messages: keys.length - missing.length,
    fetched,
    missing,
    ...(unused && { previousUnused: unused }),
  };
}
