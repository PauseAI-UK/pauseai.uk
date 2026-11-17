import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ACTION_NOT_FOUND, keepDraftOnReload } from "./stale-actions.client";
import SiteUpdated from "./SiteUpdated";
import { SiteUpdatedExample } from "./SiteUpdated.gallery.client";
import { shellCopy } from "./copy";

// Reloading would take the test page with it.
const { reloadPage } = vi.hoisted(() => ({ reloadPage: vi.fn() }));
vi.mock("@/lib/leave-page.client", () => ({ reloadPage }));

const copy = shellCopy.siteUpdated;

/** The window's fetch, answering as a Server Action the site has, or one it doesn't. */
const answering = () =>
  vi.fn(async (input: RequestInfo | URL) =>
    String(input).endsWith("/gone")
      ? new Response("", { status: 404, headers: { [ACTION_NOT_FOUND]: "1" } })
      : new Response("ok"),
  );

afterEach(() => vi.unstubAllGlobals());

describe("SiteUpdated", () => {
  it("says the site's been updated once a button calls what it no longer has, and reloads", async () => {
    const real = answering();
    vi.stubGlobal("fetch", real);
    const view = await render(<SiteUpdated />);
    const dialog = page.getByRole("dialog", { name: copy.title });
    // What the site has answers as ever, and nothing shows.
    expect(await (await fetch("/staff/broadcasts/4")).text()).toBe("ok");
    await expect.element(dialog).not.toBeInTheDocument();
    const answer = await fetch("/staff/gone");
    expect(answer.status).toBe(404);
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveTextContent(`×${copy.title}${copy.words}${copy.reload}`);
    // Again while it's open: it stays as it is.
    await fetch("/staff/gone");
    await page.getByRole("button", { name: copy.reload }).click();
    expect(reloadPage).toHaveBeenCalled();
    // Closed, to copy something first; the next call opens it again.
    await page.getByRole("button", { name: copy.close }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    await fetch("/staff/gone");
    await expect.element(dialog).toBeVisible();
    // Gone, it leaves the window's fetch as it was.
    await view.unmount();
    expect(window.fetch).toBe(real);
  });

  it("says a draft's changes are kept only while the page has a draft writer", async () => {
    vi.stubGlobal("fetch", answering());
    await render(<SiteUpdated />);
    const dialog = page.getByRole("dialog", { name: copy.title });
    const unkeep = keepDraftOnReload();
    await fetch("/staff/gone");
    await expect.element(dialog).toHaveTextContent(`×${copy.title}${copy.words}${copy.kept}${copy.reload}`);
    await page.getByRole("button", { name: copy.close }).click();
    // The writer gone, the next opening says nothing's kept.
    unkeep();
    await fetch("/staff/gone");
    await expect.element(dialog).toHaveTextContent(`×${copy.title}${copy.words}${copy.reload}`);
  });

  it("shows itself in the gallery once its button calls an action no build has", async () => {
    const real = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response("", {
          status: 404,
          headers: new Headers(init?.headers).has("Next-Action") ? { [ACTION_NOT_FOUND]: "1" } : {},
        }),
    );
    vi.stubGlobal("fetch", real);
    await render(<SiteUpdatedExample />);
    await page.getByRole("button", { name: "Press a button after a deploy" }).click();
    await expect.element(page.getByRole("dialog", { name: copy.title })).toBeVisible();
    expect(real).toHaveBeenCalledWith("/", expect.objectContaining({ method: "POST" }));
  });

  it("tells every page part watching, and keeps watching till the last stops", async () => {
    const real = answering();
    vi.stubGlobal("fetch", real);
    const first = await render(<SiteUpdated />);
    const second = await render(<SiteUpdated />);
    await first.unmount();
    expect(window.fetch).not.toBe(real);
    await fetch("/staff/gone");
    await expect.element(page.getByRole("dialog", { name: copy.title })).toBeVisible();
    await second.unmount();
    expect(window.fetch).toBe(real);
  });
});
