import { describe, expect, it } from "vitest";
import { THEYWORKFORYOU_PEOPLE_DATA, wikidataAnswer } from "@/lib/server/fixtures/politician-lists";
import { peopleIn, peopleQuery, theyWorkForYouIds } from "./wikidata";

describe("Wikidata's people", () => {
  it("asks for the people with each ID, by its property", () => {
    const query = peopleQuery("P4651", ["92001", "92002"]);
    expect(query).toContain('VALUES ?id { "92001" "92002" }');
    expect(query).toContain("?person wdt:P4651 ?id");
  });

  it("reads each person's gender and surname, by their ID", () => {
    expect(peopleIn(wikidataAnswer('"92001"'))).toEqual(new Map([["92001", { gender: "female", surname: "Example" }]]));
  });

  it("calls a trans man male and anyone else other, keeps the first answer for someone with two, and knows when it doesn't know", () => {
    const binding = (id: string, gender?: string, surname?: string) => ({
      id: { value: id },
      ...(gender && { gender: { value: `http://www.wikidata.org/entity/${gender}` } }),
      ...(surname && { surname: { value: surname } }),
    });
    const people = peopleIn({
      results: {
        bindings: [
          binding("1", "Q2449503"),
          binding("2", "Q48270", "Example"),
          binding("2", "Q6581097", "Other"),
          binding("3"),
          binding("3", undefined, "Later"),
        ],
      },
    });
    expect(people.get("1")).toEqual({ gender: "male", surname: undefined });
    expect(people.get("2")).toEqual({ gender: "other", surname: "Example" });
    expect(people.get("3")).toEqual({ gender: undefined, surname: "Later" });
    expect(() => peopleIn({})).toThrow("no results");
    expect(() => peopleIn(null)).toThrow("no results");
  });
});

describe("TheyWorkForYou's people", () => {
  it("gives each MSP's TheyWorkForYou ID by the Scottish Parliament's, and skips everyone else", () => {
    expect(
      theyWorkForYouIds({
        persons: [...THEYWORKFORYOU_PEOPLE_DATA.persons, { id: "uk.org.publicwhip/person/1" }],
      }),
    ).toEqual(new Map([[91001, "99001"]]));
    expect(() => theyWorkForYouIds({})).toThrow("no people");
    expect(() => theyWorkForYouIds(null)).toThrow("no people");
  });
});
