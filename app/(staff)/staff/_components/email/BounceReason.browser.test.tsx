import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import BounceReason, { problemSource, shortReason } from "./BounceReason";
import { emailCopy } from "./copy";

describe("shortReason", () => {
  it.each([
    [
      "550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking the recipient's email address for typos. https://support.google.com/mail/?p=NoSuchUser - gsmtp",
      "The email account that",
    ],
    [
      "554 5.7.1 [HM08] Message rejected due to local policy. Please visit https://support.apple.com/en-us/HT204137. Txn ID 0a5c",
      "Message rejected due to",
    ],
    ["452 4.2.2 The recipient's inbox is out of storage space.", "The recipient's inbox is"],
  ])("cuts %s to a few words of its first sentence, without status codes", (reason, short) => {
    expect(shortReason(reason)).toBe(short);
  });

  it("shows a short first sentence whole, and folds what comes after it", () => {
    expect(shortReason("Mailbox full. Try again later.")).toBe("Mailbox full.");
  });

  it.each(["Mailbox closed", "Mailbox closed. ", "550 5.1.1 Unknown user"])(
    "has nothing to fold in %s, a few words at most",
    (reason) => {
      expect(shortReason(reason)).toBeNull();
    },
  );
});

describe("BounceReason", () => {
  it("folds a long reason to its first words and …, which unfolds the whole and folds it again", async () => {
    const reason = "550 5.4.1 Recipient address rejected: Access denied. For more information see https://aka.ms/x";
    await render(<BounceReason reason={reason} />);
    const more = page.getByText("…", { exact: true });
    const whole = page.getByText(reason, { exact: true });
    expect(document.querySelector("summary")!.textContent).toMatch(/^Recipient address …/);
    await expect.element(more).toBeVisible();
    await expect.element(whole).not.toBeVisible();
    await more.click();
    await expect.element(whole).toBeVisible();
    await expect.element(more).not.toBeVisible();
    await whole.click();
    await expect.element(more).toBeVisible();
  });

  it("shows a short reason whole, with nothing to unfold", async () => {
    await render(<BounceReason reason="Unknown user" />);
    await expect.element(page.getByText("Unknown user", { exact: true })).toBeVisible();
    expect(document.querySelector("details")).toBeNull();
  });
});

describe("problemSource", () => {
  it("names who told us: Postmark, someone's Gmail, CiviCRM for a hold, or WhatsApp for a text", () => {
    const { from } = emailCopy.emails;
    expect(problemSource({ kind: "hard", foundInGmail: false })).toBe(from.postmark);
    expect(problemSource({ kind: "hard", foundInGmail: true })).toBe(from.gmail);
    expect(problemSource({ kind: "hold", foundInGmail: false })).toBe(from.civicrm);
    expect(problemSource({ kind: "not-on-whatsapp", foundInGmail: false })).toBe(from.whatsapp);
  });
});
