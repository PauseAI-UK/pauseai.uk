import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import DevPreferences, { type DevCopy } from "./DevPreferences";

const copy = staffCopy.devPreferences;
const SENT = new Date("2026-11-01T10:00:00Z");

/** Copies newest first, as the supporter's page lists them. */
const COPIES: DevCopy[] = [
  { copyId: 5, channel: "email", topics: ["newsletter"], sentAt: null },
  { copyId: 4, channel: "email", topics: ["newsletter"], sentAt: SENT },
  { copyId: 3, channel: "text", topics: ["events"], sentAt: SENT },
  { copyId: 2, channel: "email", topics: ["newsletter"], sentAt: SENT },
  { copyId: 1, channel: "email", topics: ["newsletter", "events"], sentAt: SENT },
];

describe("DevPreferences", () => {
  it("links each address's contact preferences, and the latest email's unsubscribe page per set of topics", async () => {
    await render(<DevPreferences emails={["jane.smith@example.com", "jane+x@example.org"]} copies={COPIES} fixtures />);
    await expect.element(page.getByRole("region", { name: copy.title })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.preferences("jane+x@example.org") }))
      .toHaveAttribute("href", "/staff/api/dev-contact-preferences?address=jane%2Bx%40example.org");
    // Not one still to go, nor a text: the latest sent by email of each.
    await expect
      .element(page.getByRole("link", { name: copy.unsubscribe("Newsletter") }))
      .toHaveAttribute("href", "/staff/api/dev-contact-preferences?copy=4");
    await expect
      .element(page.getByRole("link", { name: copy.unsubscribe("Newsletter and Events only") }))
      .toHaveAttribute("href", "/staff/api/dev-contact-preferences?copy=1");
    await expect.element(page.getByRole("link")).toHaveLength(4);
  });

  it("is nothing outside a fixture build, or for someone with no address", async () => {
    await render(<DevPreferences emails={["jane.smith@example.com"]} copies={COPIES} fixtures={false} />);
    await render(<DevPreferences emails={[]} copies={COPIES} fixtures />);
    await expect.element(page.getByRole("link")).not.toBeInTheDocument();
  });
});
