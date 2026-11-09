import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MailingDoc } from "@/lib/mailing-doc";
import { addTestPolitician, connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { stubLettersInboxEnv } from "@/tests/gmail-sends";
import { query } from "./db";
import { listRuns } from "./import-runs";
import { runTidying } from "./log-retention";
import { createDraft, saveDraft, scheduleMailing } from "./mailing-drafts";
import { runSending } from "./sending-job";

const JO = "jo@pauseai.uk";
const LETTER: MailingDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

describeWithDatabase("the sending and the tidying, as runs of the import log", () => {
  useTestDatabase();
  beforeEach(() => {
    stubLettersInboxEnv();
    vi.useFakeTimers({ now: new Date("2026-11-01T09:00:00Z"), toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("keeps an hour's sending as a run: unchanged with nothing to send, done once a mailing is started", async () => {
    expect(await runSending("nightly")).toEqual({
      started: [],
      sent: 0,
      skipped: 0,
      failed: 0,
      left: 0,
      waiting: [],
      queue: { sent: 0, left: 0 },
    });
    await addTestPolitician({ name: "Polly Placeholder", email: "polly@parliament.example" });
    await connectTestGmail(JO);
    const { id } = await createDraft(JO, { list: "politicians", params: {} }, { subject: "AI", body: LETTER });
    const saved = await saveDraft(id, 1, {
      sentFrom: JO,
      fromName: "Jo Staff",
      dueAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(await scheduleMailing(id, (saved as { version: number }).version, JO)).toEqual({ scheduled: true });
    vi.setSystemTime(new Date("2026-11-01T10:01:00Z"));
    const result = await runSending(JO);
    expect(result.started).toEqual([id]);
    expect(await listRuns("send-mailings")).toMatchObject([
      { status: "ok", startedBy: JO, result: { started: [id] } },
      { status: "unchanged", startedBy: "nightly" },
    ]);
  });

  it("finishes a mailing whose only letter a stopped run left sending, marking it uncertain first", async () => {
    await addTestPolitician({ name: "Polly Placeholder", email: "polly@parliament.example" });
    await connectTestGmail(JO);
    const { id } = await createDraft(JO, { list: "politicians", params: {} }, { subject: "AI", body: LETTER });
    const saved = await saveDraft(id, 1, {
      sentFrom: JO,
      fromName: "Jo Staff",
      dueAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(await scheduleMailing(id, (saved as { version: number }).version, JO)).toEqual({ scheduled: true });
    // A run took its letter an hour ago, and stopped.
    await query(
      `UPDATE letters l SET status = 'sending', taken_at = now() - interval '1 hour' FROM letters_from_pauseai p
       WHERE p.id = l.id AND p.mailing_id = $1`,
      [id],
    );
    vi.setSystemTime(new Date("2026-11-01T10:01:00Z"));
    expect(await runSending("nightly")).toMatchObject({ started: [id], sent: 0, left: 0 });
    expect(await query("SELECT state FROM mailings WHERE id = $1", [id])).toEqual([{ state: "sent" }]);
    expect(
      await query("SELECT l.status FROM letters l JOIN letters_from_pauseai p USING (id) WHERE p.mailing_id = $1", [
        id,
      ]),
    ).toEqual([{ status: "uncertain" }]);
  });

  it("keeps a night's tidying as a run: done when something went, unchanged when nothing did", async () => {
    await query(
      "INSERT INTO import_runs (job, at, status) VALUES ('import-luma', now() - interval '8 days', 'ok'), ('import-luma', now(), 'ok')",
    );
    expect(await runTidying("nightly")).toEqual({ importRuns: 1, auditEntries: 0, drafts: 0 });
    expect(await runTidying(JO)).toEqual({ importRuns: 0, auditEntries: 0, drafts: 0 });
    expect(await listRuns("tidy-logs")).toMatchObject([
      { status: "unchanged", startedBy: JO },
      { status: "ok", startedBy: "nightly", result: { importRuns: 1 } },
    ]);
  });
});
