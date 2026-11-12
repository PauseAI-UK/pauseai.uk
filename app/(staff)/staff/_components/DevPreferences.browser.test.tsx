import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import DevPreferences from "./DevPreferences";

const copy = staffCopy.devPreferences;
const JANE = "jane.smith@example.com";

/** The newsletter and volunteering by email, events only by text. */
const PERMISSIONS = [
  { address: JANE, topic: "newsletter", way: "email", send: "yes" },
  { address: "+447700900123", topic: "events", way: "text", send: "yes" },
  { address: JANE, topic: "events", way: "email", send: "no" },
  { address: JANE, topic: "volunteering", way: "email", send: "yes" },
] as const;

describe("DevPreferences", () => {
  it("links each address's contact preferences, and an unsubscribe page per topic they get by email", async () => {
    await render(<DevPreferences emails={[JANE, "jane+x@example.org"]} permissions={[...PERMISSIONS]} fixtures />);
    await expect.element(page.getByRole("region", { name: copy.title })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.preferences("jane+x@example.org") }))
      .toHaveAttribute("href", "/staff/api/dev-contact-preferences?address=jane%2Bx%40example.org");
    await expect
      .element(page.getByRole("link", { name: copy.unsubscribe("Volunteering") }))
      .toHaveAttribute(
        "href",
        "/staff/api/dev-contact-preferences?address=jane.smith%40example.com&topic=volunteering",
      );
    await expect.element(page.getByRole("link", { name: copy.unsubscribe("Events only") })).not.toBeInTheDocument();
    await expect.element(page.getByRole("link")).toHaveLength(4);
  });

  it("is nothing outside a fixture build, or for someone with no address", async () => {
    await render(<DevPreferences emails={[JANE]} permissions={[...PERMISSIONS]} fixtures={false} />);
    await render(<DevPreferences emails={[]} permissions={[]} fixtures />);
    await expect.element(page.getByRole("link")).not.toBeInTheDocument();
  });
});
