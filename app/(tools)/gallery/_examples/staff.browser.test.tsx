import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { NoticeExample } from "./staff.client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

describe("the staff examples", () => {
  it("closes a Notice with its ×, and opens it again", async () => {
    await render(<NoticeExample />);
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Open it again" }).click();
    await expect.element(page.getByRole("button", { name: "Close" })).toBeVisible();
  });
});
