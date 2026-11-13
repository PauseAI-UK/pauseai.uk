import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import LetterStatus from "./LetterStatus";

const tags = staffCopy.copyStates.tags;
const shown = () => [...document.querySelectorAll("span > span")].map((tag) => tag.textContent);

describe("LetterStatus", () => {
  it("shows one tag, an answer in place of how it went", async () => {
    await render(<LetterStatus status="sent" answered replied />);
    await expect.element(page.getByText(tags.answered!, { exact: true })).toBeVisible();
    expect(shown()).toEqual([tags.answered]);
  });

  it("shows how one that didn't go went, and why, in its colour, though answered", async () => {
    await render(<LetterStatus status="not_sent" sentBy="gmail" answered replied={false} />);
    await expect.element(page.getByText(tags["error:gmail"]!, { exact: true })).toBeVisible();
    expect(shown()).toEqual([tags["error:gmail"]]);
  });

  it("shows a skip with why", async () => {
    await render(<LetterStatus status="skipped" skipReason="left-office" answered={false} replied />);
    expect(shown()).toEqual([tags["not-sent:left-office"]]);
  });

  it("wraps a long tag in a narrow cell that keeps its words on one line, rather than running out of it", async () => {
    await render(
      <table style={{ width: 120 }}>
        <tbody>
          <tr>
            <td style={{ whiteSpace: "nowrap" }}>
              <LetterStatus status="skipped" skipReason="no-email" answered={false} replied={false} />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    const tag = page.getByText(tags["not-sent:no-email"]!, { exact: true }).element();
    expect(getComputedStyle(tag).whiteSpace).toBe("normal");
    expect(tag.getBoundingClientRect().width).toBeLessThanOrEqual(120);
  });
});
