import { describe, expect, it } from "vitest";
import { count, plural } from "./plural";

describe("plural", () => {
  it("takes the first word for one and the second for none or more", () => {
    expect([0, 1, 2].map((n) => plural(n, "entry", "entries"))).toEqual(["entries", "entry", "entries"]);
  });

  it("puts the count before the word", () => {
    expect([0, 1, 2].map((n) => count(n, "person", "people"))).toEqual(["0 people", "1 person", "2 people"]);
  });
});
