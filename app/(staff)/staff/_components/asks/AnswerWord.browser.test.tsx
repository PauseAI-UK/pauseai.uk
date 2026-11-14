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
        <AnswerWord status={null} />
      </>,
    );
    expect(mark(staffVocabulary.statuses.signed)).toContain("✓");
    expect(mark(staffVocabulary.statuses.going)).toContain("✓");
    expect(mark(staffVocabulary.statuses.declined)).toContain("✕");
    expect(mark(staffVocabulary.statuses.other)).toBe("none");
    expect(mark(staffVocabulary.statuses.noAnswer)).toBe("none");
  });
});
