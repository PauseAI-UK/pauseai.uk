import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import ErrorMain from "@/components/layout/ErrorMain";
import type { reportBrowserError } from "@/lib/browser-errors";
import { errorPageCopy } from "@/lib/content/error-page";
import MarchError from "./(march)/demonstrations/march-against-ai-extinction-nov-26/error";
import SiteError from "./(site)/error";
import StaffOuterError from "./(staff)/error";
import SignedInError from "./(staff)/staff/(signed-in)/error";
import SignedInNotFound from "./(staff)/staff/(signed-in)/not-found";
import StaffError from "./(staff)/staff/_components/shell/StaffError";
import { shellCopy } from "./(staff)/staff/_components/shell/copy";
import ToolsError from "./(tools)/error";

/** An error as the server's arrives: its words gone, a digest in their place, so nothing is told of it. */
const fromServer = () =>
  Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });

const reports = () => vi.fn<typeof reportBrowserError>();

describe("the public error page", () => {
  it("says the page went wrong, tells the site of what the browser threw, and loads the page again", async () => {
    const report = reports();
    const retry = vi.fn();
    const thrown = new TypeError("rows is undefined");
    await render(<ErrorMain error={thrown} retry={retry} report={report} />);
    await expect.element(page.getByRole("heading", { name: errorPageCopy.title })).toBeVisible();
    await expect.element(page.getByText(errorPageCopy.body)).toBeVisible();
    await expect.element(page.getByRole("main")).toBeInTheDocument();
    expect(report.mock.calls).toEqual([["browser-page", thrown]]);
    await page.getByRole("button", { name: errorPageCopy.retry }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says it inside another page's main, as the gallery shows it, and takes an id for a skip link", async () => {
    const shown = await render(<ErrorMain error={fromServer()} retry={() => {}} as="div" />);
    await expect.element(page.getByRole("heading", { name: errorPageCopy.title })).toBeVisible();
    await expect.element(page.getByRole("main")).not.toBeInTheDocument();
    await shown.rerender(<ErrorMain error={fromServer()} retry={() => {}} id="main" />);
    await expect.element(page.getByRole("main")).toHaveAttribute("id", "main");
  });

  it.each([
    ["the site's", SiteError],
    ["the tools'", ToolsError],
    ["the staff pages' outside the signed-in ones", StaffOuterError],
  ])("is %s error page", async (_whose, ErrorPage) => {
    await render(<ErrorPage error={fromServer()} retry={() => {}} />);
    await expect.element(page.getByRole("heading", { name: errorPageCopy.title })).toBeVisible();
  });

  it("is the march sign-up's, where the layout's skip link leads", async () => {
    await render(<MarchError error={fromServer()} retry={() => {}} />);
    await expect.element(page.getByRole("main")).toHaveAttribute("id", "main");
  });
});

describe("the staff error page", () => {
  it("says the page hit an error, tells the site of what the browser threw, and loads the page again", async () => {
    const report = reports();
    const retry = vi.fn();
    const thrown = new TypeError("rows is undefined");
    await render(<StaffError error={thrown} retry={retry} report={report} />);
    await expect.element(page.getByRole("heading", { name: shellCopy.error.title })).toBeVisible();
    await expect.element(page.getByRole("alert")).toHaveTextContent(shellCopy.error.words);
    expect(report.mock.calls).toEqual([["browser-page", thrown]]);
    await page.getByRole("button", { name: shellCopy.error.retry }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("is the signed-in pages' error page", async () => {
    await render(<SignedInError error={fromServer()} retry={() => {}} />);
    await expect.element(page.getByRole("heading", { name: shellCopy.error.title })).toBeVisible();
  });

  it("has a page of its own for a record that isn't there, which the signed-in pages show beside the navigation", async () => {
    await render(<SignedInNotFound />);
    await expect.element(page.getByRole("heading", { name: shellCopy.notFound.title })).toBeVisible();
    await expect.element(page.getByText(shellCopy.notFound.words)).toBeVisible();
  });
});
