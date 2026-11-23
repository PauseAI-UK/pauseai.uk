import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { EDM_ASK } from "@/lib/asks/asks";
import { EDM_API } from "@/lib/asks/edm";
import { type EdmImport, NIGHTLY } from "@/lib/import-runs";
import { importEdm } from "./edm-import.server";
import { query } from "@/lib/server/db.server";
import { listRuns } from "@/lib/server/import-runs.server";
import { importPoliticians } from "@/lib/politicians/imports.server";
import { jobsCopy } from "./copy";

const signed = () =>
  query<{ name: string; date: string; by: string }>(
    `SELECT n.name, s.status_date::text AS date, s.updated_by AS by
     FROM ask_statuses s JOIN notable_people n ON n.id = s.notable_person_id
     WHERE s.ask = $1 ORDER BY n.name`,
    [EDM_ASK],
  );

/** The motion's answer, signed by these Parliament IDs. */
const signedBy = (...ids: number[]) =>
  server.use(
    http.get(EDM_API, () =>
      HttpResponse.json({
        Response: {
          Sponsors: ids.map((id) => ({
            MemberId: id,
            Member: { Name: `Member ${id}` },
            CreatedWhen: "2026-11-20T10:00:00",
          })),
        },
      }),
    ),
  );

beforeEach(() => vi.stubEnv("TEST_MP_EMAIL", "test-mp@parliament.example"));
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("importEdm", () => {
  useTestDatabase();

  it("marks each MP who signed, on the day they signed, and logs each", async () => {
    await importPoliticians("parliament", NIGHTLY);
    expect(await importEdm(NIGHTLY)).toEqual({ signers: 2, matched: 2, added: 2, removed: 0, unmatched: [] });
    expect(await signed()).toEqual([
      { name: "Mo Example", date: "2026-11-11", by: "parliament" },
      { name: "Polly Placeholder", date: "2026-11-09", by: "parliament" },
    ]);
    expect(await query("SELECT count(*)::int AS n FROM audit_log WHERE action = 'set status'")).toEqual([{ n: 2 }]);
    expect(await importEdm(NIGHTLY)).toMatchObject({ added: 0, removed: 0 });
  });

  it("takes off someone no longer signed, and reports a signer who's no one here as a problem of the run", async () => {
    await importPoliticians("parliament", NIGHTLY);
    await importEdm(NIGHTLY);
    signedBy(90003, 90001, 99999);
    const result = await importEdm(NIGHTLY);
    expect(result).toMatchObject({ signers: 3, matched: 2, added: 1, removed: 1 });
    expect(result.unmatched).toEqual(["Member 99999 (99999)"]);
    expect((await signed()).map((s) => s.name)).toEqual(["Mo Example", "Ms Dora Dummy"]);
    const [run] = (await listRuns("import-edm")) as EdmImport[];
    expect(run.problems).toEqual([
      expect.objectContaining({ what: jobsCopy.edm.unmatched, error: "Member 99999 (99999)" }),
    ]);
  });

  it("changes nothing when no one has signed, as the answer's shape must have changed", async () => {
    signedBy();
    await expect(importEdm(NIGHTLY)).rejects.toThrow("No one has signed");
    const [run] = await listRuns("import-edm");
    expect(run.status).toBe("failed");
  });
});
