import { describe, expect, it } from "vitest";
import { groupMetadata, groupPages } from "./group-pages";
import { groups } from "./groups";
import { site } from "./site";

describe("group pages", () => {
  it("has a page for every group, under its own name", () => {
    expect(Object.keys(groupPages).sort()).toEqual(groups.map((g) => g.name).sort());
    for (const [name, page] of Object.entries(groupPages)) expect(page.name).toBe(name);
  });

  it("gives every page a hero action", () => {
    for (const page of Object.values(groupPages)) expect(page.hero.actions.length, page.name).toBeGreaterThan(0);
  });

  it("gives every contact section a WhatsApp button and an email button, the first the only primary one", () => {
    for (const { name, contact } of Object.values(groupPages)) {
      const hrefs = contact.actions.map((action) => action.href);
      expect(hrefs, name).toContain(site.whatsappUrl);
      expect(
        hrefs.filter((href) => href.startsWith("mailto:")),
        name,
      ).toHaveLength(1);
      expect(
        contact.actions.map((action) => action.variant),
        name,
      ).toEqual(["primary", ...contact.actions.slice(1).map(() => "ghost")]);
    }
  });

  it("leads with a group's own address, and with WhatsApp where the email goes to the team", () => {
    const first = (name: keyof typeof groupPages) => groupPages[name].contact.actions[0].href;
    for (const name of ["Oxford", "Leicester", "Cambridge"] as const) expect(first(name), name).toMatch(/^mailto:/);
    for (const name of ["London", "Scotland", "West of England", "Parents", "Teachers"] as const) {
      expect(first(name), name).toBe(site.whatsappUrl);
      expect(groupPages[name].contact.actions[1].href, name).toBe(`mailto:${site.contactEmail}`);
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
