import { describe, expect, it } from "vitest";
import { ASK_STATUSES } from "@/lib/asks/asks";
import { COUNTRIES, PERSON_STATUSES } from "@/lib/politicians/records.server";
import { staffVocabulary } from "./staff-vocabulary";

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
    // Every status any kind of ask allows, and the words for no answer.
    expect(Object.keys(staffVocabulary.statuses).sort()).toEqual(
      [...new Set(Object.values(ASK_STATUSES).flat()), "noAnswer"].sort(),
    );
    expect(Object.keys(staffVocabulary.personStatuses)).toEqual([...PERSON_STATUSES]);
    expect(Object.keys(staffVocabulary.countries)).toEqual([...COUNTRIES]);
  });
});
