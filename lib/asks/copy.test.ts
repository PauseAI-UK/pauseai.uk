import { expect, it } from "vitest";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { INVITED } from "./asks";
import { asksCopy, standingWord } from "./copy";

it("names the ask being edited", () => {
  expect(asksCopy.asks.editTitle("Winter reception")).toContain("Winter reception");
});

it("says where someone stands on an ask: their answer, or by its kind that they were asked or never were", () => {
  expect(standingWord("going", "event")).toBe(staffVocabulary.statuses.going);
  expect(standingWord("declined")).toBe(staffVocabulary.statuses.declined);
  expect(standingWord(INVITED, "event")).toBe(staffVocabulary.invited.event);
  expect(standingWord(INVITED, "letter")).toBe(staffVocabulary.invited.letter);
  expect(standingWord(null, "letter")).toBe(staffVocabulary.neverAsked.letter);
  // With no kind, as a filter with no ask chosen has it, words for either.
  expect(standingWord(INVITED)).toBe(staffVocabulary.invited.any);
  expect(standingWord(null)).toBe(staffVocabulary.neverAsked.any);
});
