import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { whatsappCopy as copy } from "@/lib/content/whatsapp";
import WaitingRoomDown from "./WaitingRoomDown";

describe("WaitingRoomDown", () => {
  it("says the waiting room is down, and leads to the home page's sign-up", async () => {
    await render(<WaitingRoomDown />);
    await expect.element(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
    await expect.element(page.getByText(copy.body)).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.button })).toHaveAttribute("href", "/#join");
  });
});
