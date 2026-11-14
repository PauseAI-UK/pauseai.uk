import { afterEach, expect, it, vi } from "vitest";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { LETTERS_INBOX, recordGmail, testProxy } from "@/tests/gmail-sends";
import { LETTERS_DAILY_LIMIT } from "./letters-inbox.server";
import { lettersInboxEmail } from "./channels.server";

const MESSAGE_TO_POLLY = {
  from: { name: "Jo Staff", address: "jo@pauseai.uk" },
  to: { name: "Polly", address: "polly@example.org" },
  subject: "AI",
  html: "",
  text: "Hi",
  attachments: [],
};

describeWithDatabase("lettersInboxEmail", () => {
  useTestDatabase();
  afterEach(() => vi.unstubAllEnvs());

  it("sends from a supporter's proxy by the letters inbox, up to its own limit, at no cost, reporting nothing", async () => {
    await connectTestGmail(LETTERS_INBOX);
    const sent = recordGmail();
    const proxy = testProxy("jane.smith");
    const result = await lettersInboxEmail.send(
      { ...MESSAGE_TO_POLLY, from: { name: "Jane Smith", address: proxy } },
      "letter",
    );
    expect(result).toMatchObject({ sent: true });
    expect([sent[0].account, sent[0].headers.get("from"), sent[0].headers.get("to")]).toEqual([
      LETTERS_INBOX,
      `"Jane Smith (via PauseAI)" <${proxy}>`,
      '"Polly" <polly@example.org>',
    ]);
    expect(await query("SELECT purpose, letter_id, sender FROM email_sends")).toEqual([
      { purpose: "letter", letter_id: null, sender: LETTERS_INBOX },
    ]);
    expect(lettersInboxEmail.sendsMailings).toBe(false);
    expect(await lettersInboxEmail.remainingToday(LETTERS_INBOX)).toBe(LETTERS_DAILY_LIMIT - 1);
    expect(lettersInboxEmail.cost(MESSAGE_TO_POLLY)).toBe(0);
    expect(lettersInboxEmail.report({})).toBeUndefined();
  });
});
