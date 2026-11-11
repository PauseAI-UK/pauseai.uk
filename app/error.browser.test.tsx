import { afterEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import SiteError from "./(site)/error";
import StaffError from "./(staff)/staff/(signed-in)/error";
import RootError from "./error";

afterEach(() => vi.restoreAllMocks());

/** An error as the server's arrives, which no page tells the site of again. */
const fromServer = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1234" });

it("each error page says something went wrong, with a button that tries again", async () => {
  for (const Page of [RootError, SiteError, StaffError]) {
    const retry = vi.fn();
    const { unmount } = await render(<Page error={fromServer} retry={retry} />);
    await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /Try again/ }).click();
    expect(retry).toHaveBeenCalledTimes(1);
    await unmount();
  }
});

it("the staff's keeps to the staff pages' words, and the public ones lead home", async () => {
  const staff = await render(<StaffError error={fromServer} retry={() => {}} />);
  await expect.element(page.getByText(staffCopy.errorPage.body)).toBeVisible();
  expect(page.getByRole("link").elements()).toEqual([]);
  await staff.unmount();
  await render(<SiteError error={fromServer} retry={() => {}} />);
  await expect.element(page.getByRole("link", { name: /homepage/ })).toHaveAttribute("href", "/");
});

it("the staff's tells the site of an error the browser threw", async () => {
  const fetch = vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  await render(<StaffError error={new Error("Thrown in the browser")} retry={() => {}} />);
  expect(fetch).toHaveBeenCalledTimes(1);
});
