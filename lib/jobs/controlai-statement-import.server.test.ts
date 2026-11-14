import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { CONTROLAI_STATEMENT_ASK } from "@/lib/asks/asks";
import { CONTROLAI_STATEMENT_PAGE } from "@/lib/controlai-statement";
import { type ControlAiStatementImport, NIGHTLY } from "@/lib/import-runs";
import { importControlAiStatement } from "./controlai-statement-import.server";
import { query } from "@/lib/server/db.server";
import { listRuns } from "@/lib/server/import-runs.server";
import { importPoliticians } from "@/lib/politicians/imports.server";
import { jobsCopy } from "./copy";

const signed = () =>
  query<{ name: string; by: string }>(
    `SELECT n.name, s.updated_by AS by FROM ask_statuses s JOIN notable_people n ON n.id = s.notable_person_id
     WHERE s.ask = $1 ORDER BY n.name`,
    [CONTROLAI_STATEMENT_ASK],
  );

/** Every body's fixture politicians. */
async function importEveryone() {
  for (const body of ["parliament", "scottish-parliament", "senedd", "ni-assembly"] as const) {
    await importPoliticians(body, NIGHTLY);
  }
}

beforeEach(() => vi.stubEnv("TEST_MP_EMAIL", "test-mp@parliament.example"));
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("importControlAiStatement", () => {
  useTestDatabase();

  it("marks each supporter it links to as having signed, by ID or by name, and logs each", async () => {
    await importEveryone();
    const result = await importControlAiStatement(NIGHTLY);
    expect(result).toEqual({ supporters: 5, matched: 5, added: 5, removed: 0, unmatched: [] });
    expect(await signed()).toEqual([
      { name: "Aoife Example", by: "controlai" },
      { name: "Gwen Example", by: "controlai" },
      { name: "Lord Seedling of Example", by: "controlai" },
      { name: "Morag Example", by: "controlai" },
      { name: "Polly Placeholder", by: "controlai" },
    ]);
    expect(await query("SELECT count(*)::int AS n FROM audit_log WHERE action = 'set status'")).toEqual([{ n: 5 }]);
    expect(await importControlAiStatement(NIGHTLY)).toMatchObject({ added: 0, removed: 0 });
  });

  it("takes off someone no longer linked, and reports a link to no one here as a problem of the run", async () => {
    await importEveryone();
    await importControlAiStatement(NIGHTLY);
    server.use(
      http.get(CONTROLAI_STATEMENT_PAGE, () =>
        HttpResponse.text(
          [90002, 90101, 90001, 90003, 99999]
            .map((id) => `<a href="https://members.parliament.uk/member/${id}/contact"></a>`)
            .join(""),
        ),
      ),
    );
    const result = await importControlAiStatement(NIGHTLY);
    expect(result).toMatchObject({ matched: 4, added: 2, removed: 3 });
    expect(result.unmatched).toEqual(["https://members.parliament.uk/member/99999/contact"]);
    const [run] = (await listRuns("import-controlai-statement")) as ControlAiStatementImport[];
    expect(run.problems).toEqual([
      expect.objectContaining({ what: jobsCopy.controlAiStatement.unmatched, error: result.unmatched[0] }),
    ]);
  });

  it("changes nothing when the page links to too few, as its shape must have changed", async () => {
    server.use(http.get(CONTROLAI_STATEMENT_PAGE, () => HttpResponse.text("<p>Coming soon</p>")));
    await expect(importControlAiStatement(NIGHTLY)).rejects.toThrow("Only 0 supporters");
    const [run] = await listRuns("import-controlai-statement");
    expect(run.status).toBe("failed");
  });
});
