import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import LetterStatus from "./LetterStatus";

const answered = staffCopy.mailings.columns.answered;
const replied = staffCopy.letters.status.replied;
const tags = () => [...document.querySelectorAll("span > span")].map((tag) => tag.textContent);

describe("LetterStatus", () => {
  it("shows Answered beside how the letter went, not in its place, and not Replied as well", async () => {
    await render(<LetterStatus status="bounced" answered replied />);
    await expect.element(page.getByText(answered, { exact: true })).toBeVisible();
    expect(tags()).toEqual([staffCopy.letters.status.bounced, answered]);
    // Side by side, a little apart.
    expect(getComputedStyle(page.getByText(answered, { exact: true }).element().parentElement!).columnGap).toBe("4px");
  });

  it("shows Replied beside it when not answered, and the skip with why", async () => {
    await render(<LetterStatus status="skipped" skipReason="left-office" answered={false} replied />);
    await expect.element(page.getByText(replied, { exact: true })).toBeVisible();
    expect(tags()).toEqual([staffCopy.mailingPages.skipReasons["left-office"], replied]);
  });

  it("shows the status alone when neither", async () => {
    await render(<LetterStatus status="sent" answered={false} replied={false} />);
    await expect.element(page.getByText(staffCopy.letters.status.sent, { exact: true })).toBeVisible();
    expect(tags()).toEqual([staffCopy.letters.status.sent]);
  });
});
