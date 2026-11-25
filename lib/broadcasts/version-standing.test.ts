import { describe, expect, it } from "vitest";
import { versionStanding } from "./version-standing";

const approved = { id: 1, status: "approved" };
const pending = { id: 2, status: "pending" };
const rejected = { id: 3, status: "rejected" };

describe("versionStanding", () => {
  it("stands on nothing with no template chosen or stored: new words, free to change", () => {
    const none = { chosen: undefined, waiting: undefined, rejected: undefined, fixed: false };
    expect(versionStanding(null, null, [approved])).toEqual(none);
    expect(versionStanding(null, undefined, [])).toEqual(none);
  });

  it("is fixed as the approved template chosen, found in the list, or the stored one where the list lacks it", () => {
    expect(versionStanding(1, null, [approved])).toMatchObject({ chosen: approved, fixed: true });
    expect(versionStanding(1, approved, [])).toMatchObject({ chosen: approved, fixed: true });
    // One the page chose that isn't approved, or isn't the stored one, is no template.
    expect(versionStanding(4, approved, [])).toMatchObject({ chosen: undefined, fixed: false });
    expect(versionStanding(2, pending, [])).toMatchObject({ chosen: undefined });
  });

  it("is new words when the page has chosen none, though the draft has an approved one stored", () => {
    expect(versionStanding(null, approved, [approved])).toMatchObject({ chosen: undefined, fixed: false });
  });

  it("is fixed while WhatsApp reviews its words", () => {
    expect(versionStanding(null, pending, [approved])).toEqual({
      chosen: undefined,
      waiting: pending,
      rejected: undefined,
      fixed: true,
    });
  });

  it("says its words were rejected, free to change, till a template is chosen", () => {
    expect(versionStanding(null, rejected, [approved])).toMatchObject({ rejected, fixed: false });
    expect(versionStanding(1, rejected, [approved])).toMatchObject({ chosen: approved, rejected: undefined });
  });
});
