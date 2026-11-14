import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { DeleteTwice } from "./DeleteTwice";
import { staffVocabulary } from "@/lib/staff-vocabulary";

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
