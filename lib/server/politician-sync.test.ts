import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import fixture from "@/lib/server/fixtures/airtable-politicians.json";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import type { PoliticianSync } from "@/lib/import-runs";
import { query } from "./db";
import { listRuns } from "./import-runs";
import { syncPoliticians } from "./politician-sync";

const JO = "jo@pauseai.uk";

// Airtable's API, matched without naming its host, which only lib/server/outside-services/airtable.ts does.
const AIRTABLE = "https://*.airtable.com/v0/*";

const people = () =>
  query<{
    airtableId: string | null;
    name: string;
    salutation: string;
    notes: string;
    important: boolean;
    connection: boolean;
    toCheck: boolean;
  }>(
    `SELECT n.airtable_id AS "airtableId", n.name, n.salutation, n.notes, n.important_target AS important,
       n.personal_connection AS connection, n.salutation_to_check AS "toCheck"
     FROM notable_people n JOIN politicians p ON p.id = n.id WHERE NOT p.is_test ORDER BY n.name`,
  );

beforeEach(() => vi.stubEnv("AIRTABLE_TOKEN", "token"));
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("syncPoliticians", () => {
  useTestDatabase();

  it("adds no one: it lists the records it found no one for", async () => {
    const result = await syncPoliticians(JO);
    expect(result.changes.changed).toEqual([]);
    expect(result.unmatched).toHaveLength(fixture.records.length);
    expect(await people()).toEqual([]);
    const [run] = (await listRuns("sync-politicians")) as PoliticianSync[];
    expect(run).toMatchObject({ status: "unchanged", startedBy: JO });
  });

  it("copies a salutation, the markers and notes to the politician with the record, or by name, and logs each", async () => {
    await addTestPolitician({ name: "Polly Placeholder", salutation: "Polly Placeholder", airtableId: null });
    await query("UPDATE notable_people SET salutation_to_check = true");
    await addTestPolitician({ name: "Somebody Else", airtableId: "recMorag", salutation: "Mx Else" });
    const result = await syncPoliticians(JO);
    expect(result.changes.changed.map((p) => p.airtableId).sort()).toEqual(["recMorag", "recPlaceholder"]);
    expect(await people()).toEqual([
      {
        airtableId: "recPlaceholder",
        name: "Polly Placeholder",
        salutation: "Ms Placeholder",
        notes: "Met at the example fair.\nRecommended",
        important: true,
        connection: false,
        toCheck: false,
      },
      {
        airtableId: "recMorag",
        name: "Somebody Else",
        salutation: "Ms Example",
        notes: "",
        important: false,
        connection: true,
        toCheck: false,
      },
    ]);
    const logged = await query<{ details: { name: string; changed: object } }>(
      "SELECT details FROM audit_log WHERE action = 'edit politician' ORDER BY id",
    );
    expect(logged.map((row) => row.details.name).sort()).toEqual(["Polly Placeholder", "Somebody Else"]);
    expect((await syncPoliticians(JO)).changes.changed).toEqual([]);
  });

  it("fails without AIRTABLE_TOKEN, keeping the run", async () => {
    vi.stubEnv("AIRTABLE_TOKEN", "");
    await expect(syncPoliticians(JO)).rejects.toThrow("AIRTABLE_TOKEN isn't set");
    const [run] = await listRuns("sync-politicians");
    expect(run.status).toBe("failed");
  });

  it("keeps our salutation where Airtable has none, and a salutation to check while it's still the name", async () => {
    await addTestPolitician({
      name: "Lord Seedling of Example",
      salutation: "Lord Seedling of Example",
      airtableId: null,
    });
    await query("UPDATE notable_people SET salutation_to_check = true");
    server.use(
      http.get(AIRTABLE, () =>
        HttpResponse.json({
          records: [
            { id: "recSeedling", fields: { "Full name or Title": "Lord Seedling of Example", Body: "House of Lords" } },
          ],
        }),
      ),
    );
    await syncPoliticians(JO);
    expect((await people())[0]).toMatchObject({
      airtableId: "recSeedling",
      salutation: "Lord Seedling of Example",
      toCheck: true,
    });
  });
});
