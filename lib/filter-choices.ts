// What a repeating filter's URL values become when one of its lozenges changes.
import { NOT } from "@/lib/staff-search";

/**
 * A repeating filter's values once its lozenge for what it finds, or with
 * `not` what it leaves out, holds `chosen` in place of `was`: `all` are the
 * filter's values now and `was` this lozenge's, each marked. Choosing
 * nothing takes off this lozenge. Leaving out all of `every`, its choices,
 * by this lozenge and the other, takes off the filter. Where a record has only one value of it (`oneEach`),
 * one way of choosing rules out the other, so what the other lozenge has goes.
 */
export function chosenValues({
  all,
  was,
  chosen,
  not,
  oneEach,
  every,
}: {
  all: string[];
  was: string[];
  chosen: string[];
  not: boolean;
  oneEach: boolean;
  every: string[];
}): string[] {
  const marked = (value: string) => (not ? NOT + value : value);
  const others = all.filter((value) => !was.includes(value));
  if (chosen.length === 0) return others;
  const kept = oneEach ? [] : others;
  const leftOut = not
    ? [...chosen, ...kept.filter((value) => value.startsWith(NOT)).map((v) => v.slice(NOT.length))]
    : [];
  if (every.length > 0 && every.every((value) => leftOut.includes(value))) return [];
  return [...kept, ...chosen.map(marked)];
}
