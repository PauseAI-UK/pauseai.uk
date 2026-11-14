import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import BounceReason, { firstSentence } from "./email/BounceReason";
import { DeleteTwice } from "./DeleteTwice";

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
    await expect.element(page.getByText(staffCopy.emails.from.postmark)).toBeVisible();
  });

  it("names who told us after the reason: Postmark, someone's Gmail, or CiviCRM for a hold", async () => {
    const { rerender } = await render(<BounceReason reason="Unknown user" kind="hard" foundInGmail={false} />);
    await expect.element(page.getByText(staffCopy.emails.from.postmark)).toBeVisible();
    await rerender(<BounceReason reason="Unknown user" kind="hard" foundInGmail />);
    await expect.element(page.getByText(staffCopy.emails.from.gmail)).toBeVisible();
    await rerender(<BounceReason reason="On hold" kind="hold" foundInGmail={false} />);
    await expect.element(page.getByText(staffCopy.emails.from.civicrm)).toBeVisible();
  });
});

describe("DeleteTwice", () => {
  it("sends any more fields it's given with the form", async () => {
    const action = vi.fn();
    await render(<DeleteTwice name="id" value="1" fields={{ list: "events" }} label="Delete" action={action} />);
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.poll(() => action.mock.calls.length).toBe(1);
    const sent = action.mock.calls[0][0] as FormData;
    expect(sent.get("id")).toBe("1");
    expect(sent.get("list")).toBe("events");
  });

  it("can't be armed when disabled", async () => {
    await render(<DeleteTwice name="slug" value="x" label="Delete ask" disabled action={vi.fn()} />);
    await expect.element(page.getByRole("button", { name: "Delete ask" })).toBeDisabled();
  });
});
