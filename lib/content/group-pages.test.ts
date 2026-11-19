import { describe, expect, it } from "vitest";
import { groupMetadata, groupPages } from "./group-pages";
import { groups } from "./groups";

describe("group pages", () => {
  it("has a page for every group, under its own name", () => {
    expect(Object.keys(groupPages).sort()).toEqual(groups.map((g) => g.name).sort());
    for (const [name, page] of Object.entries(groupPages)) expect(page.name).toBe(name);
  });

  it("gives every page a hero action and a contact button", () => {
    for (const page of Object.values(groupPages)) {
      expect(page.hero.actions.length, page.name).toBeGreaterThan(0);
      expect(page.contact.actions.length, page.name).toBeGreaterThan(0);
    }
  });
});

describe("groupMetadata", () => {
  it("builds the group's titles, social cards and canonical path", () => {
    expect(groupMetadata("Oxford", "About Oxford.")).toEqual({
      title: "Oxford Group",
      openGraph: {
        title: "PauseAI Oxford",
        description: "About Oxford.",
        images: [{ url: "/images/open-graph/open-graph-1200-630.jpg", width: 1200, height: 630 }],
        url: "https://pauseai.uk/oxford",
      },
      twitter: {
        title: "PauseAI Oxford",
        description: "About Oxford.",
        images: ["/images/open-graph/open-graph-1080-1080.jpg"],
      },
      alternates: { canonical: "/oxford" },
    });
  });

  it("titles an affinity group's page in the group's own words", () => {
    const [parents] = groups.filter((group) => group.name === "Parents");
    const metadata = groupMetadata("Parents", "About parents.");
    expect(metadata.title).toBe(parents.words.label);
    expect(metadata.openGraph).toMatchObject({ title: parents.words.title, url: "https://pauseai.uk/parents" });
    expect(metadata.alternates).toEqual({ canonical: "/parents" });
  });
});
