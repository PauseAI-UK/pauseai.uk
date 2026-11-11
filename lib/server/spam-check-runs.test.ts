import { afterEach, expect, it, vi } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { REFUSALS_BEFORE_EMAIL } from "@/lib/spam-check-runs";
import { staffTime } from "@/lib/staff-time";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { notifications } from "@/tests/notifications";
import { query } from "./db";
import { countSpamCheck } from "./spam-check-runs";

const words = staffCopy.notifications.lettersRefused;

const run = async () =>
  (
    await query<{ refused: number; since: Date | null; alerted: boolean }>(
      "SELECT refused, since, alerted FROM spam_check_runs",
    )
  )[0];

/** So many letters refused, one after another. */
async function refuse(times: number) {
  for (let n = 0; n < times; n++) await countSpamCheck("letter", false);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describeWithDatabase("counting the spam check's answers", () => {
  useTestDatabase();

  it("emails staff once when several letters in a row are refused, saying since when", async () => {
    const sent = notifications();
    await refuse(REFUSALS_BEFORE_EMAIL - 1);
    expect(sent).toEqual([]);
    await refuse(2);
    const { refused, since, alerted } = await run();
    expect([refused, alerted]).toEqual([REFUSALS_BEFORE_EMAIL + 1, true]);
    expect(sent).toEqual([
      expect.objectContaining({
        Subject: words.subject(REFUSALS_BEFORE_EMAIL),
        TextBody: words.body(REFUSALS_BEFORE_EMAIL, staffTime(since!), "https://pauseai.uk/staff/errors"),
      }),
    ]);
  });

  it("starts again once a letter gets through", async () => {
    const sent = notifications();
    await countSpamCheck("letter", true);
    expect(await run()).toBeUndefined();
    await refuse(REFUSALS_BEFORE_EMAIL);
    await countSpamCheck("letter", true);
    expect(await run()).toEqual({ refused: 0, since: null, alerted: false });
    await refuse(REFUSALS_BEFORE_EMAIL - 1);
    expect(sent).toHaveLength(1);
    await refuse(1);
    expect(sent).toHaveLength(2);
  });

  it("sends one email when refusals arrive at once", async () => {
    const sent = notifications();
    await refuse(REFUSALS_BEFORE_EMAIL - 1);
    await Promise.all([refuse(1), refuse(1), refuse(1)]);
    expect(sent).toHaveLength(1);
  });

  it("counts without an email where there's no notification inbox", async () => {
    await refuse(REFUSALS_BEFORE_EMAIL);
    expect(await run()).toEqual(expect.objectContaining({ refused: REFUSALS_BEFORE_EMAIL, alerted: false }));
  });

  it("reports a count it can't keep, and carries on", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NETLIFY_DB_URL", "");
    await countSpamCheck("letter", false);
    expect(logged).toHaveBeenCalledWith(staffCopy.problems.logs.spamCheckNotCounted, "NETLIFY_DB_URL is not set");
  });
});
