import { describe, expect, it } from "vitest";
import { affinityGroups, groupNamed, groups } from "./groups";
import { localGroups } from "./local-groups";

describe("groups", () => {
  it("lists every local group, then every affinity group, each once", () => {
    expect(groups.map((group) => group.name)).toEqual([
      ...localGroups.map((group) => group.name),
      ...affinityGroups.map((group) => group.name),
    ]);
    expect(new Set(groups.map((group) => group.href)).size).toBe(groups.length);
  });

  it("words a local group's page and header from its place", () => {
    const oxford = groupNamed("Oxford");
    expect(oxford.href).toBe("/oxford");
    expect(oxford.words).toEqual({
      title: "PauseAI Oxford",
      label: "Oxford Group",
      upcoming: "Upcoming events in Oxford",
      nothingOn: "Nothing is listed in Oxford just now.",
      past: "Past events in Oxford",
    });
    // The header logo comes with it.
    expect(groupNamed("Manchester").logo?.src).toContain("manchester_logo");
  });

  it("gives an affinity group words of its own, and a name in the menu", () => {
    for (const group of affinityGroups) {
      expect(groupNamed(group.name).words).toBe(group.words);
      for (const words of [group.menu, ...Object.values(group.words)]) expect(words, group.name).not.toBe("");
      expect(group.eventMatchers.length, group.name).toBeGreaterThan(0);
    }
  });
});
