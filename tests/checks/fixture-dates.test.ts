import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_NOW } from "@/lib/server/fixtures/fixture-env.mjs";

// A fixture build's clock is fixed at FIXTURE_NOW, and what a person said last
// about a consent is what holds. So a fixture dated after the clock beats
// anything a flow does "now": a member who joined after it can't be opted out.
// Every date in the outside services' canned answers is before the clock, but
// for those meant to be to come.

const FIXTURES = join(__dirname, "..", "..", "lib", "server", "fixtures");

/** The fixtures whose dates are to come: the events Luma lists as upcoming. */
const TO_COME = new Set(["luma-calendar-future.json"]);

/** Stripe's times, in seconds since 1970. */
const SECONDS = new Set(["created"]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Every date in `value`, with where it is. */
export function datesIn(value: unknown, path = ""): { path: string; at: number }[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => datesIn(item, `${path}[${i}]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const at = `${path}.${key}`;
    if (typeof item === "string" && ISO_DATE.test(item)) return [{ path: at, at: Date.parse(item) }];
    if (typeof item === "number" && SECONDS.has(key)) return [{ path: at, at: item * 1000 }];
    return datesIn(item, at);
  });
}

describe("fixture dates", () => {
  it("finds a date as a string, Stripe's in seconds, and those in lists, and nothing else", () => {
    expect(
      datesIn({ a: "2026-10-20", b: [{ created: 1 }], c: { d: "2026-10-16T12:00:00.000Z" }, e: 5, f: "x" }),
    ).toEqual([
      { path: ".a", at: Date.parse("2026-10-20") },
      { path: ".b[0].created", at: 1000 },
      { path: ".c.d", at: Date.parse("2026-10-16T12:00:00.000Z") },
    ]);
  });

  const files = readdirSync(FIXTURES).filter((name) => name.endsWith(".json") && !TO_COME.has(name));

  it.each(files)("%s has no date after the fixture clock", (name) => {
    const dates = datesIn(JSON.parse(readFileSync(join(FIXTURES, name), "utf8")));
    const late = dates.filter(({ at }) => at > Date.parse(FIXTURE_NOW)).map(({ path }) => path);
    expect(late, `dated after FIXTURE_NOW (${FIXTURE_NOW}), so they outrank what a flow does now`).toEqual([]);
  });
});
