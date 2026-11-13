import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";

// The messages the site keeps whole outside the database, in Netlify Blobs:
// each night the container fetches every one through the site's read-only
// route (app/api/backup/messages) and writes them into one tar file, each
// gzipped as the site keeps it, under its key. The Worker stores it beside
// the dump, and it expires as the dumps do, so a message erased on the site
// leaves the backups with them.

export interface MessagesReport {
  bytes: number;
  sha256: string;
  /** How many messages are in the archive. */
  messages: number;
  /** The keys the site listed but had no message for. */
  missing: string[];
}

/** Asks the site, with a path, as fetch does, with the backup's secret. */
export type Site = (path: string) => Promise<Response>;

const BLOCK = 512;

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

/**
 * Fetches every message the site lists into a tar file at `path`, each
 * named by its key, dated `at`. Says how big the file is, its hash, how
 * many it holds, and any the site listed but couldn't send. Throws if the
 * site won't list them, or a send fails other than as missing.
 */
export async function archiveMessages(site: Site, path: string, at: Date): Promise<MessagesReport> {
  const listed = await site("/api/backup/messages");
  if (!listed.ok) throw new Error(`The site wouldn't list its messages: ${listed.status}.`);
  const { keys } = (await listed.json()) as { keys: string[] };
  const out = createWriteStream(path);
  const hash = createHash("sha256");
  let bytes = 0;
  const write = async (chunk: Buffer) => {
    hash.update(chunk);
    bytes += chunk.length;
    if (!out.write(chunk)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
  };
  const missing: string[] = [];
  try {
    for (const key of keys) {
      const file = await site(`/api/backup/messages?key=${encodeURIComponent(key)}`);
      if (file.status === 404) {
        missing.push(key);
        continue;
      }
      if (!file.ok) throw new Error(`The site wouldn't send message ${key}: ${file.status}.`);
      const data = Buffer.from(await file.arrayBuffer());
      await write(tarHeader(key, data.length, at));
      await write(data);
      await write(Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
    }
    // Two empty blocks end the archive.
    await write(Buffer.alloc(BLOCK * 2));
  } finally {
    await new Promise<void>((resolve) => out.end(() => resolve()));
  }
  return { bytes, sha256: hash.digest("hex"), messages: keys.length - missing.length, missing };
}
