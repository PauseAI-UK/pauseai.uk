import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import ResultBox, { OPEN_UP_TO } from "./ResultBox";

describe("ResultBox", () => {
  it("is one line without detail, and folds detail under the line, open only when short", async () => {
    const { rerender } = await render(<ResultBox summary="Just a line" />);
    await expect.element(page.getByRole("status")).toHaveTextContent("Just a line");
    await expect.element(page.getByRole("group")).not.toBeInTheDocument();

    await rerender(
      <ResultBox summary="Short" lines={OPEN_UP_TO} actions={<button>Act</button>}>
        <p>Detail</p>
      </ResultBox>,
    );
    expect((page.getByRole("group").element() as HTMLDetailsElement).open).toBe(true);
    await expect.element(page.getByText("Detail")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Act" })).toBeVisible();

    await rerender(
      <ResultBox summary="Long" lines={OPEN_UP_TO + 1}>
        <p>Detail</p>
      </ResultBox>,
    );
    expect((page.getByRole("group").element() as HTMLDetailsElement).open).toBe(false);
    await expect.element(page.getByText("Detail")).not.toBeVisible();
  });

  it("is plain: the ordinary border and no tint", async () => {
    await render(<ResultBox summary="Plain" />);
    const box = page.getByRole("status").element().closest("section")!;
    expect(getComputedStyle(box).borderLeftWidth).toBe("1px");
    expect(getComputedStyle(box).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });
});
