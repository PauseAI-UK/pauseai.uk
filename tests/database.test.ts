import { expect, it } from "vitest";
import { query } from "@/lib/server/db";
import { describeWithDatabase, useTestDatabase } from "./database";

// The tests run in order: the first writes, the second sees what was emptied.
describeWithDatabase("each test's database", () => {
  useTestDatabase();
  const counts = () =>
    query<{ asks: number; campaigns: number; mailings: number; presses: number }>(
      `SELECT (SELECT count(*)::int FROM asks) AS asks, (SELECT count(*)::int FROM campaigns) AS campaigns,
              (SELECT count(*)::int FROM mailings) AS mailings, (SELECT count(*)::int FROM job_presses) AS presses`,
    ).then(([row]) => row);
  let seeded: Awaited<ReturnType<typeof counts>>;

  it("starts with the migrations' asks, campaigns and mailings", async () => {
    seeded = await counts();
    expect(seeded.asks).toBeGreaterThan(0);
    expect(seeded.campaigns).toBeGreaterThan(0);
    expect(seeded.mailings).toBeGreaterThan(0);
    expect(seeded.presses).toBe(0);
    await query("INSERT INTO job_presses (job, started_by) VALUES ('tidy-logs', 'sam@pauseai.uk')");
    await query(
      `INSERT INTO mailings (title, audience, channel, body, state)
       VALUES ('A test mailing', 'politicians', 'email', '{"type": "doc", "content": []}', 'draft')`,
    );
  });

  it("empties every other table before the next test, and the mailings a test wrote", async () => {
    expect(await counts()).toEqual(seeded);
  });
});
