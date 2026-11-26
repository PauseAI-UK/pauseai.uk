import { describe, expect, it } from "vitest";
import type { MailingDoc } from "@/lib/mailings/doc";
import { versionStanding } from "./version-standing";

const words = (text: string): MailingDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const variant = (id: number, status: string, text: string) => ({
  id,
  status,
  body: words(text),
  header: null,
  buttons: [],
});
const march = variant(1, "approved", "The march is on Saturday.");
const written = (text: string) => ({ body: words(text), header: null, buttons: [] });

describe("versionStanding", () => {
  it("stands on nothing for new words: free to change, to go for approval", () => {
    const none = { approved: undefined, chosen: undefined, waiting: undefined, rejected: undefined, fixed: false };
    expect(versionStanding(written("Rain on Saturday."), null, [march], false)).toEqual(none);
    expect(versionStanding(written("Rain on Saturday."), undefined, [], false)).toEqual(none);
  });

  it("is fixed as the approved variant its words are, found among the approved ones or the stored one itself", () => {
    expect(versionStanding(written("The march is on Saturday."), null, [march], false)).toMatchObject({
      approved: march,
      chosen: march,
      fixed: true,
    });
    const stored = variant(2, "approved", "Rain on Saturday.");
    expect(versionStanding(written("Rain on Saturday."), stored, [march], false)).toMatchObject({ chosen: stored });
    // Not once its words, its header kind or its buttons differ, nor for one that's not approved now.
    expect(versionStanding(written("Rain on Sunday."), stored, [march], false)).toMatchObject({ approved: undefined });
    const mapped = { ...written("The march is on Saturday."), header: "location" as const };
    expect(versionStanding(mapped, null, [march], false)).toMatchObject({ approved: undefined, fixed: false });
    const paused = variant(3, "paused", "Rain on Saturday.");
    expect(versionStanding(written("Rain on Saturday."), paused, [paused], false)).toMatchObject({
      approved: undefined,
    });
  });

  it("is free to change while it's edited as a new template, though its words are still an approved variant's", () => {
    expect(versionStanding(written("The march is on Saturday."), march, [march], true)).toEqual({
      approved: march,
      chosen: undefined,
      waiting: undefined,
      rejected: undefined,
      fixed: false,
    });
  });

  it("is fixed while WhatsApp reviews its words, whatever is approved", () => {
    const pending = variant(4, "pending", "The march is on Saturday.");
    expect(versionStanding(written("The march is on Saturday."), pending, [march], false)).toEqual({
      approved: undefined,
      chosen: undefined,
      waiting: pending,
      rejected: undefined,
      fixed: true,
    });
  });

  it("says its words were rejected, free to change, till they're an approved variant's", () => {
    const rejected = variant(5, "rejected", "Rain on Saturday.");
    expect(versionStanding(written("Rain, again."), rejected, [march], false)).toMatchObject({
      rejected,
      fixed: false,
    });
    expect(versionStanding(written("The march is on Saturday."), rejected, [march], false)).toMatchObject({
      chosen: march,
      rejected: undefined,
    });
  });
});
