import { describe, expect, it } from "vitest";
import { march, marchEventJsonLd, novemberMarch } from "./march";

describe("marchEventJsonLd", () => {
  it("describes a march as a free, in-person event at its start, linking to its page and Luma", () => {
    const data = marchEventJsonLd(novemberMarch);
    expect(data).toMatchObject({
      "@type": "Event",
      name: "March Against AI Extinction",
      startDate: "2026-11-21T12:00:00Z",
      endDate: "2026-11-21T15:00:00Z",
      location: {
        name: "All Souls' Place",
        address: { streetAddress: "All Souls' Place", postalCode: "W1B 3DA", addressLocality: "London" },
      },
      offers: { url: "https://luma.com/pauseai-nov26", price: "0" },
      url: "https://pauseai.uk/demonstrations/march-against-ai-extinction-nov-26/",
    });
    expect(data.image).toEqual(["https://pauseai.uk/images/march-nov-26/luma-cover.webp"]);
  });

  it("places a march whose route isn't settled in London alone", () => {
    const data = marchEventJsonLd(march);
    expect(data).toMatchObject({
      startDate: "2027-04-10T11:00:00Z",
      endDate: "2027-04-10T14:00:00Z",
      offers: { url: "https://luma.com/pauseai-april-27" },
      url: "https://pauseai.uk/demonstrations/march-against-ai-extinction-apr-27/",
    });
    expect(data.location).toEqual({
      "@type": "Place",
      name: "London",
      address: { "@type": "PostalAddress", addressLocality: "London", addressCountry: "GB" },
    });
  });
});

describe("the marches", () => {
  it.each([novemberMarch, march])("ends after it starts, on its day", (one) => {
    expect(new Date(one.endAt) > new Date(one.startAt)).toBe(true);
    expect(one.startAt.startsWith(one.dateIso)).toBe(true);
  });

  it("has the next march after the last", () => {
    expect(new Date(march.startAt) > new Date(novemberMarch.endAt)).toBe(true);
  });
});
