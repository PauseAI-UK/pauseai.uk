import { describe, expect, it } from "vitest";
import { ASK_STATUSES } from "@/lib/asks/asks";
import { COUNTRIES, PERSON_STATUSES } from "@/lib/politicians/filters";
import { staffVocabulary } from "./staff-vocabulary";
import { politiciansCopy } from "@/lib/politicians/copy";

describe("staff vocabulary", () => {
  it("names every house and status", () => {
    expect(Object.keys(staffVocabulary.houses)).toEqual([
      "commons",
      "lords",
      "scottish-parliament",
      "senedd",
      "ni-assembly",
      "other",
    ]);
    // Every answer any kind of ask allows.
    expect(Object.keys(staffVocabulary.statuses).sort()).toEqual(
      [...new Set(Object.values(ASK_STATUSES).flat())].sort(),
    );
    // That they were asked, and never were, in each kind's words.
    const kinds = Object.keys(ASK_STATUSES).sort();
    expect(Object.keys(staffVocabulary.invited).sort()).toEqual(kinds);
    expect(Object.keys(staffVocabulary.neverAsked).sort()).toEqual(kinds);
    expect(Object.keys(politiciansCopy.personStatuses)).toEqual([...PERSON_STATUSES]);
    expect(Object.keys(staffVocabulary.countries)).toEqual([...COUNTRIES]);
  });
});
