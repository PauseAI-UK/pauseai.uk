import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import AnswerWord from "./AnswerWord";

describe("AnswerWord", () => {
  const mark = (name: string) => getComputedStyle(page.getByText(name).element(), "::before").content;

  it("ticks a yes, crosses a no, and marks nothing else", async () => {
    await render(
      <>
        <AnswerWord status="signed" />
        <AnswerWord status="going" />
        <AnswerWord status="declined" />
        <AnswerWord status="other" />
        <AnswerWord status="invited" kind="event" />
        <AnswerWord status={null} kind="letter" />
        <AnswerWord status="invited" kind="letter" waiting />
        <AnswerWord status={null} kind="event" waiting />
      </>,
    );
    // Waiting, they were asked as the choice beside the answers says it, the words after it on a line of their own;
    // never asked is the same either way.
    const after = page.getByText(staffVocabulary.noReplyYetAfter, { exact: true }).element();
    expect(after.parentElement!.textContent).toBe(staffVocabulary.noReplyYet.letter);
    expect(after.getBoundingClientRect().top).toBeGreaterThan(after.parentElement!.getBoundingClientRect().top);
    await expect.element(page.getByText(staffVocabulary.neverAsked.event, { exact: true })).toBeVisible();
    expect(mark(staffVocabulary.statuses.signed)).toContain("✓");
    expect(mark(staffVocabulary.statuses.going)).toContain("✓");
    expect(mark(staffVocabulary.statuses.declined)).toContain("✕");
    expect(mark(staffVocabulary.statuses.other)).toBe("none");
    // That they were asked, or never were, each in the words of the ask's kind.
    expect(mark(staffVocabulary.invited.event)).toBe("none");
    expect(mark(staffVocabulary.neverAsked.letter)).toBe("none");
  });
});
