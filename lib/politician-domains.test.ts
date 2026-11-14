import { describe, expect, it } from "vitest";
import { domainOf, isSharedDomain, ownDomains, plainName } from "./politician-domains";
describe("plainName", () => {
  it("ignores titles, MP, spacing and case", () => {
    expect(plainName("Dr Ellie Chowns")).toBe("ellie chowns");
    expect(plainName("The Rt Hon Sir  Iain Duncan Smith MP")).toBe("iain duncan smith");
    expect(plainName("Mrs. Sureena Brackenridge")).toBe("sureena brackenridge");
    expect(plainName("Louise Sandher-Jones")).toBe("louise sandher-jones");
  });
});

describe("a politician's own domains", () => {
  it("reads a domain from an email or web address, without www", () => {
    expect(domainOf("Office@Tulip.Example")).toBe("tulip.example");
    expect(domainOf("https://www.tulip.example/about?x=1")).toBe("tulip.example");
    expect(domainOf("tulip.example/about")).toBe("tulip.example");
    expect(domainOf("nothing")).toBeUndefined();
  });

  it("reads a web address with a handle in it as the site's, not the handle's", () => {
    expect(domainOf("https://www.tiktok.com/@ben.maguire.mp")).toBe("tiktok.com");
    expect(domainOf("youtube.com/@SteveBarclayMP")).toBe("youtube.com");
  });

  it("knows shared domains whatever their ending, and the public sector's", () => {
    for (const shared of [
      "sinnfein.ie",
      "sinnfein.org",
      "yahoo.co.uk",
      "x.com",
      "me.com",
      "dcms.gov.uk",
      "gov.scot",
      "ox.ac.uk",
      "harvard.edu",
      "parliament.uk",
      "mla.niassembly.gov.uk",
    ]) {
      expect(isSharedDomain(shared), shared).toBe(true);
    }
    for (const own of ["tulip.example", "jane.me.uk", "meghillier.com", "bayoalaba.substack.com"]) {
      expect(isSharedDomain(own), own).toBe(false);
    }
  });

  it("keeps one held by one politician, leaving out parliaments, parties and social media", () => {
    const domains = ownDomains([
      {
        id: 1,
        addresses: [
          "a@tulip.example",
          "https://facebook.com/x",
          "b@parliament.uk",
          "https://www.labour.org.uk/a",
          "https://www.tiktok.com/@lib.dem.olly",
          "a@sinnfein.ie",
          "nothing",
        ],
      },
      { id: 2, addresses: ["https://shared.example"] },
      { id: 3, addresses: ["x@shared.example", "y@gmail.com"] },
    ]);
    expect(domains).toEqual(new Map([["tulip.example", 1]]));
  });
});
