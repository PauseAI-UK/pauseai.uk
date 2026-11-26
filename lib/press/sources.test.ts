import { describe, expect, it } from "vitest";
import {
  KINDS,
  namesUs,
  readSources,
  SOURCE_KINDS,
  SOURCES_SCHEMA,
  sourcesPrompt,
  TIER_UNKNOWN,
  TIERS,
  type Source,
} from "./sources";

const SOURCES: Source[] = [
  { site: "examplegazette.co.uk", name: "The Example Gazette" },
  { site: "examplewire.com", name: "Example Wire" },
];
const OUTLETS = ["The Example Gazette", "TIME"];

it("sourcesPrompt lists the outlets, and each source by its place in the list", () => {
  const prompt = sourcesPrompt(SOURCES, OUTLETS);
  expect(JSON.parse(/<outlets>(.*)<\/outlets>/.exec(prompt)![1])).toEqual(OUTLETS);
  expect(JSON.parse(/<sources>(.*)<\/sources>/.exec(prompt)![1])).toEqual([
    { id: "0", name: "The Example Gazette", site: "examplegazette.co.uk" },
    { id: "1", name: "Example Wire", site: "examplewire.com" },
  ]);
});

it("the schema asks for a kind, an outlet and a reason for each source, and each kind has a tier", () => {
  const item = SOURCES_SCHEMA.properties.sources.items;
  expect(item.required).toEqual(["id", "kind", "sameAs", "why"]);
  expect(item.properties.kind.enum).toEqual([...SOURCE_KINDS, "unknown"]);
  for (const kind of SOURCE_KINDS) expect(TIERS).toContain(KINDS[kind]);
  // News agencies are worth as much as major news, whoever owns them; a government's own papers are worth nothing.
  expect([KINDS["news-agency"], KINDS["state-media"]]).toEqual([2, 4]);
  expect(TIERS).toContain(TIER_UNKNOWN);
});

describe("readSources", () => {
  it("keeps a judgement for each source answered for, with its site, kind and the tier it has, outlet and reason", () => {
    const answer = {
      sources: [
        { id: "0", kind: "uk-regional", sameAs: "The Example Gazette", why: "A local paper." },
        { id: "1", kind: "aggregator", sameAs: null, why: "A wire's copies." },
      ],
    };
    expect(readSources(answer, SOURCES, OUTLETS)).toEqual([
      {
        site: "examplegazette.co.uk",
        kind: "uk-regional",
        tier: 3,
        sameAs: "The Example Gazette",
        reason: "A local paper.",
      },
      { site: "examplewire.com", kind: "aggregator", tier: 4, sameAs: null, reason: "A wire's copies." },
    ]);
  });

  it("gives no kind or tier for one Claude didn't know, or a kind the schema doesn't allow", () => {
    const judged = ["unknown", "tabloid", 2, undefined].map(
      (kind) => readSources({ sources: [{ id: "0", kind, sameAs: null, why: "" }] }, SOURCES, OUTLETS)[0],
    );
    expect(judged.map(({ kind, tier }) => [kind, tier])).toEqual([
      [null, null],
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("gives no outlet for one that isn't on the list, or isn't a name", () => {
    const sameAs = ["The Times", "time", 7].map(
      (outlet) =>
        readSources({ sources: [{ id: "0", kind: "uk-national", sameAs: outlet, why: "" }] }, SOURCES, OUTLETS)[0]
          .sameAs,
    );
    expect(sameAs).toEqual([null, null, null]);
  });

  it("cuts a long reason short, and keeps a missing one as blank", () => {
    const [long, none] = readSources(
      {
        sources: [
          { id: "0", kind: "uk-national", sameAs: null, why: "a".repeat(400) },
          { id: "1", kind: "uk-national", sameAs: null },
        ],
      },
      SOURCES,
      OUTLETS,
    );
    expect(long.reason).toBe("a".repeat(300));
    expect(none.reason).toBe("");
  });

  it("keeps the first answer for a source answered twice, and leaves out one not asked about", () => {
    const answer = {
      sources: [
        null,
        { id: "7", kind: "uk-national", sameAs: null, why: "Not asked." },
        { kind: "uk-national", sameAs: null, why: "No id." },
        { id: "1", kind: "aggregator", sameAs: null, why: "First." },
        { id: "1", kind: "uk-national", sameAs: null, why: "Second." },
      ],
    };
    expect(readSources(answer, SOURCES, OUTLETS)).toEqual([
      { site: "examplewire.com", kind: "aggregator", tier: 4, sameAs: null, reason: "First." },
    ]);
  });

  it("gives nothing for an answer that isn't a list of sources", () => {
    for (const answer of [null, "No.", {}, { sources: "none" }]) {
      expect(readSources(answer, SOURCES, OUTLETS)).toEqual([]);
    }
  });
});

describe("namesUs", () => {
  const people = ["Joseph Miller"];

  it("is true of a headline that names PauseAI, written as one word or two in capitals", () => {
    expect(namesUs("PauseAI protesters march on Whitehall", people)).toBe(true);
    expect(namesUs("Why PauseAI's members are worried", people)).toBe(true);
    expect(namesUs("Pause AI protesters march on Whitehall", people)).toBe(true);
    // "to" here ends another word.
    expect(namesUs("Police inquiry into Pause AI protest", people)).toBe(true);
  });

  it("is false of the phrase: after 'to', or not in capitals", () => {
    expect(namesUs("Experts call to Pause AI", people)).toBe(false);
    expect(namesUs("Experts Call To Pause AI", people)).toBe(false);
    expect(namesUs("Council votes to pause AI chatbot pilot", people)).toBe(false);
    expect(namesUs("Should we pause AI?", people)).toBe(false);
  });

  it("is true of a headline that names one of our people, whatever its case", () => {
    expect(namesUs("JOSEPH MILLER warns MPs", people)).toBe(true);
    expect(namesUs("Joseph Miller warns MPs", [])).toBe(false);
  });
});
