import { afterEach, expect, it, vi } from "vitest";
import { addTestMp, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { NOTIFICATIONS, notifications } from "@/tests/notifications";
import { query } from "@/lib/server/db.server";
import { reportMailingBounces } from "./mailing-bounces.server";
import { lettersCopy } from "./copy";

afterEach(() => vi.unstubAllEnvs());
describeWithDatabase("reportMailingBounces", () => {
  useTestDatabase();

  const LINK = "https://pauseai.uk/staff/politicians/addresses-to-fix";
  const words = lettersCopy.notifications.mailingBounces;
  const ADDRESS = "test-mp@parliament.example";
  const NAME = "Testy McTestface MP";
  let messages = 0;

  /**
   * A letter to the MP sent as `purpose`, and a problem with it from `at`:
   * Postmark's, or a bounce read from Gmail with its `gmailId`, in `account`'s mailbox if it's known.
   */
  async function bounced(
    mp: number,
    reason: string,
    {
      kind = "hard",
      purpose = "mailing",
      at = "now()",
      gmailId = null as string | null,
      account = null as string | null,
    } = {},
  ) {
    const [{ id }] = await query<{ id: number }>(
      "INSERT INTO letters (kind, notable_person_id, status) VALUES ('pauseai', $1, 'bounced') RETURNING id::int AS id",
      [mp],
    );
    const messageId = `report-${++messages}`;
    await query(
      "INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id) VALUES ($1, $2, $3, 'sent', $4)",
      [purpose, id, ADDRESS, messageId],
    );
    await query(
      `INSERT INTO email_problems (address, message_id, kind, reason, can_reset, at, gmail_message_id, details)
       VALUES ($1, $2, $3, $4, $5, ${at}, $6, $7)`,
      [ADDRESS, messageId, kind, reason, kind !== "complaint", gmailId, account ? { account } : {}],
    );
  }

  function setUp() {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    return notifications();
  }

  it("says nothing when no mailing's letter bounced, nor of soft bounces, other emails, or those long past", async () => {
    const sent = setUp();
    const mp = await addTestMp();
    await reportMailingBounces(undefined);
    await bounced(mp, "Mailbox full", { kind: "soft" });
    await bounced(mp, "Unknown user", { purpose: "letter" });
    await bounced(mp, "Unknown user", { at: "now() - interval '2 days'" });
    await reportMailingBounces(undefined);
    expect(sent).toEqual([]);
  });

  it("says nothing of an MP no longer in office", async () => {
    const sent = setUp();
    const mp = await addTestMp();
    await bounced(mp, "Unknown user");
    await query("UPDATE notable_people SET status = 'left_office' WHERE id = $1", [mp]);
    await reportMailingBounces(undefined);
    expect(sent).toEqual([]);
  });

  it("lists each bounce and complaint since the last report, at most once a day", async () => {
    const sent = setUp();
    const mp = await addTestMp();
    await bounced(mp, "Unknown user");
    await bounced(mp, "Marked as spam", { kind: "complaint" });
    await reportMailingBounces(undefined);
    expect(sent).toMatchObject([
      {
        Subject: words.subject(2),
        TextBody: words.body([`- ${NAME} (${ADDRESS}): Unknown user`, `- ${NAME} (${ADDRESS}): Marked as spam`], LINK),
      },
    ]);
    // Within the day: nothing more.
    await bounced(mp, "Mailbox gone");
    await reportMailingBounces(undefined);
    expect(sent).toHaveLength(1);
    // A day on, only the one since.
    await query(
      "UPDATE email_problems SET details = jsonb_build_object('reportedAt', (now() - interval '25 hours')::text) WHERE details ? 'reportedAt'",
    );
    await reportMailingBounces(undefined);
    expect(sent.at(-1)).toMatchObject({
      Subject: words.subject(1),
      TextBody: words.body([`- ${NAME} (${ADDRESS}): Mailbox gone`], LINK),
    });
  });

  it("links each bounce read from a Gmail mailbox to it there", async () => {
    const sent = setUp();
    const mp = await addTestMp();
    await bounced(mp, "Unknown user", { gmailId: "g1", account: "jo@pauseai.uk" });
    await bounced(mp, "No such user", { gmailId: "g2" });
    await reportMailingBounces(undefined);
    expect(sent[0].TextBody).toBe(
      words.body(
        [
          `- ${NAME} (${ADDRESS}): Unknown user https://mail.google.com/mail/?authuser=jo%40pauseai.uk#all/g1`,
          `- ${NAME} (${ADDRESS}): No such user`,
        ],
        LINK,
      ),
    );
  });

  it("tells of them next time if its email didn't go", async () => {
    const sent = setUp();
    await bounced(await addTestMp(), "Unknown user");
    vi.stubEnv("NOTIFICATION_INBOX", "");
    await reportMailingBounces(undefined);
    expect(sent).toEqual([]);
    vi.stubEnv("NOTIFICATION_INBOX", NOTIFICATIONS);
    await reportMailingBounces(undefined);
    expect(sent).toHaveLength(1);
  });

  it("keeps its time apart from the supporters' report", async () => {
    const sent = setUp();
    await bounced(await addTestMp(), "Unknown user");
    // A staff report just gone doesn't hold this one back.
    await query(
      "INSERT INTO email_sends (purpose, address, outcome, message_id) VALUES ('staff-report', $1, 'sent', 'another-report')",
      [NOTIFICATIONS],
    );
    await reportMailingBounces(undefined);
    expect(sent).toHaveLength(1);
    // Nor does this one count as a staff report, which would hold that one back.
    expect(await query("SELECT purpose FROM email_sends WHERE subject = $1", [words.subject(1)])).toEqual([
      { purpose: "staff-alert" },
    ]);
  });
});
