import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import BounceReason, { firstSentence } from "./BounceReason";
import { emailCopy } from "@/lib/email/copy";

describe("firstSentence", () => {
  it.each([
    [
      "550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking the recipient's email address for typos. https://support.google.com/mail/?p=NoSuchUser - gsmtp",
      "The email account that you tried to reach does not exist.",
    ],
    [
      "554 5.7.1 [HM08] Message rejected due to local policy. Please visit https://support.apple.com/en-us/HT204137. Txn ID 0a5c",
      "Message rejected due to local policy.",
    ],
    [
      "550 5.4.1 Recipient address rejected: Access denied. For more information see https://aka.ms/EXOSmtpErrors [AB1.prod.outlook.com]",
      "Recipient address rejected: Access denied.",
    ],
  ])("cuts %s to its first sentence, without status codes", (reason, short) => {
    expect(firstSentence(reason)).toBe(short);
  });

  it.each(["452 4.2.2 The recipient's inbox is out of storage space.", "Mailbox closed", "Mailbox closed. "])(
    "has nothing to fold in %s, a sentence at most",
    (reason) => {
      expect(firstSentence(reason)).toBeNull();
    },
  );
});

describe("BounceReason", () => {
  it("folds a long reason to its first sentence and …, which unfolds the whole and folds it again", async () => {
    const reason = "550 5.4.1 Recipient address rejected: Access denied. For more information see https://aka.ms/x";
    await render(<BounceReason reason={reason} kind="hard" foundInGmail={false} />);
    const more = page.getByText("…", { exact: true });
    const whole = page.getByText(reason, { exact: true });
    expect(document.querySelector("summary")!.textContent).toMatch(/^Recipient address rejected: Access denied\. …/);
    await expect.element(more).toBeVisible();
    await expect.element(whole).not.toBeVisible();
    await more.click();
    await expect.element(whole).toBeVisible();
    await expect.element(more).not.toBeVisible();
    await whole.click();
    await expect.element(more).toBeVisible();
    await expect.element(page.getByText(emailCopy.emails.from.postmark)).toBeVisible();
  });

  it("names who told us after the reason: Postmark, someone's Gmail, or CiviCRM for a hold", async () => {
    const { rerender } = await render(<BounceReason reason="Unknown user" kind="hard" foundInGmail={false} />);
    await expect.element(page.getByText(emailCopy.emails.from.postmark)).toBeVisible();
    await rerender(<BounceReason reason="Unknown user" kind="hard" foundInGmail />);
    await expect.element(page.getByText(emailCopy.emails.from.gmail)).toBeVisible();
    await rerender(<BounceReason reason="On hold" kind="hold" foundInGmail={false} />);
    await expect.element(page.getByText(emailCopy.emails.from.civicrm)).toBeVisible();
  });
});
