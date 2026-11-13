import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { saveLetterReply } from "@/lib/server/outside-services/blobs";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("BACKUP_SECRET", "b4ckup");
  vi.stubEnv("DATA_FIXTURES", "1");
});
afterEach(() => vi.unstubAllEnvs());

const ask = (query = "", authorization = "Bearer b4ckup") =>
  GET(new NextRequest(`https://pauseai.uk/api/backup/messages${query}`, { headers: { authorization } }));

/** Replies to a letter, each kept under its key, by its Gmail ID. */
async function replies(keys: Record<string, string>): Promise<void> {
  const politician = await addTestPolitician();
  const [{ id: letter }] = await query<{ id: number }>(
    "INSERT INTO letters (kind, notable_person_id, status) VALUES ('pauseai', $1, 'sent') RETURNING id::int AS id",
    [politician],
  );
  for (const [id, key] of Object.entries(keys)) {
    await query(
      `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, at, from_us, blob_key, size)
       VALUES ($1, 'jo@pauseai.uk', $2, 't1', 'p@example.org', now(), false, $3, 5)`,
      [letter, id, key],
    );
  }
}

describeWithDatabase("GET /api/backup/messages", () => {
  useTestDatabase();

  it("lists every kept message's key, and sends each, gzipped, to the backup", async () => {
    await saveLetterReply("jo/m2.eml.gz", gzipSync("hello"));
    // m1's row has no message: it's gone.
    await replies({ m2: "jo/m2.eml.gz", m1: "jo/m1.eml.gz" });
    expect(await (await ask()).json()).toEqual({ keys: ["jo/m1.eml.gz", "jo/m2.eml.gz"] });
    const file = await ask("?key=jo%2Fm2.eml.gz");
    expect(file.headers.get("content-type")).toBe("application/gzip");
    expect(Buffer.from(await file.arrayBuffer()).equals(gzipSync("hello"))).toBe(true);
    expect((await ask("?key=jo%2Fm1.eml.gz")).status).toBe(404);
    // Only a kept message's key: no other blob.
    await saveLetterReply("other.eml.gz", gzipSync("not kept"));
    expect((await ask("?key=other.eml.gz")).status).toBe(404);
  });

  it("refuses anyone without the backup's secret", async () => {
    expect((await ask("", "Bearer guess")).status).toBe(401);
    expect((await ask("?key=jo%2Fm2.eml.gz", "Bearer guess")).status).toBe(401);
  });
});
