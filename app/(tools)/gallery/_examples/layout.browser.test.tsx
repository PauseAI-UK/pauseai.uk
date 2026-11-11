import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ErrorPageExample } from "./layout.client";

// The example's callbacks are logged, not sent: each adds its line to the event log.
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

it("logs the error page's Try again, and tells the site of nothing", async () => {
  const fetch = vi.spyOn(window, "fetch");
  await render(<ErrorPageExample />);
  await page.getByRole("button", { name: /Try again/ }).click();
  await expect.element(log().nth(0)).toHaveTextContent("retry(event)");
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
