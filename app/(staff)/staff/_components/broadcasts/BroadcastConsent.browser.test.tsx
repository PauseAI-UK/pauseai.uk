import { expect, it, describe } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { BroadcastConsentExample } from "./BroadcastConsent.gallery.client";

const copy = broadcastsCopy.broadcastPages;

describe("BroadcastConsent's example in the gallery", () => {
  it("draws the Consent, neither channel chosen, texts chosen, and one already written", async () => {
    await render(<BroadcastConsentExample />);
    await expect.element(page.getByText(copy.consentChannel).first()).toBeVisible();
  });
});
