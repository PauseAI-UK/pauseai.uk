import { describe, expect, it } from "vitest";
import { problems, timestampColumns, type Manifest } from "./checks.ts";

const AT = "2026-10-19T03:00:00.000Z";

function manifest(tables: Manifest["tables"], bytes = 1000, at = AT): Manifest {
  return { at, key: `dumps/${at}.dump`, bytes, sha256: "abc", tables };
}

describe("timestampColumns", () => {
  it("names each rule's timestamp column", () => {
    expect(timestampColumns({ a: { timestamp: "at" }, b: { minRows: 1 } })).toEqual({ a: "at" });
  });
});

describe("problems", () => {
  it("finds none in a good first backup", () => {
    expect(problems(manifest({ a: { rows: 1 } }), undefined, { a: { neverShrinks: true } })).toEqual([]);
  });

  it("finds a table missing from the backup", () => {
    expect(problems(manifest({}), undefined, { letters: {} })).toEqual(["letters: not in the backup."]);
  });

  it("finds a table with fewer rows than expected", () => {
    const rules = { politicians: { minRows: 600 } };
    expect(problems(manifest({ politicians: { rows: 12 } }), undefined, rules)).toEqual([
      "politicians: 12 rows, fewer than the 600 expected.",
    ]);
    expect(problems(manifest({ politicians: { rows: 650 } }), undefined, rules)).toEqual([]);
  });

  it("finds a table that shrank, when it should only grow", () => {
    const previous = manifest({ letters: { rows: 130 }, other: { rows: 5 } }, 1000, "2026-10-18T03:00:00.000Z");
    const current = manifest({ letters: { rows: 120 }, other: { rows: 1 } });
    expect(problems(current, previous, { letters: { neverShrinks: true }, other: {} })).toEqual([
      "letters: 120 rows, down from 130 in the backup of 2026-10-18T03:00:00.000Z.",
    ]);
    expect(problems(manifest({ letters: { rows: 131 } }), previous, { letters: { neverShrinks: true } })).toEqual([]);
  });

  it("doesn't compare a table the last backup didn't have", () => {
    const previous = manifest({});
    expect(problems(manifest({ letters: { rows: 0 } }), previous, { letters: { neverShrinks: true } })).toEqual([]);
  });

  it("finds a dump much smaller than the last", () => {
    const previous = manifest({}, 1000, "2026-10-18T03:00:00.000Z");
    expect(problems(manifest({}, 400), previous, {})).toEqual([
      "The dump is 60% smaller than in the backup of 2026-10-18T03:00:00.000Z: 400 bytes, down from 1000.",
    ]);
    expect(problems(manifest({}, 800), previous, {})).toEqual([]);
  });

  it("finds a table whose newest row is too old, or missing", () => {
    const rules = { import_runs: { timestamp: "at", newWithinHours: 36 } };
    expect(
      problems(manifest({ import_runs: { rows: 1, newest: "2026-10-18T00:00:00+00:00" } }), undefined, rules),
    ).toEqual([]);
    expect(
      problems(manifest({ import_runs: { rows: 1, newest: "2026-10-17T00:00:00+00:00" } }), undefined, rules),
    ).toEqual([
      "import_runs: the newest row is from 2026-10-17T00:00:00.000Z, but should be within 36 hours of the backup.",
    ]);
    expect(problems(manifest({ import_runs: { rows: 0, newest: null } }), undefined, rules)).toEqual([
      "import_runs: the newest row doesn't exist, but should be within 36 hours of the backup.",
    ]);
  });

  it("finds messages the site listed but couldn't send, naming a few", () => {
    const archive = (missing: string[], messages = 10) => ({
      ...manifest({}),
      messages: { key: "messages/x.tar", bytes: 1, sha256: "def", messages, fetched: messages, missing },
    });
    expect(problems(archive([]), undefined, {})).toEqual([]);
    expect(problems(archive(["a", "b"]), undefined, {})).toEqual([
      "2 of the site's messages weren't in its store: a, b.",
    ]);
    expect(problems(archive(["a", "b", "c", "d", "e", "f", "g"]), undefined, {})).toEqual([
      "7 of the site's messages weren't in its store: a, b, c, d, e, and 2 more.",
    ]);
  });

  it("finds an archive with many fewer messages than the last", () => {
    const archive = (messages: number, at = AT) => ({
      ...manifest({}, 1000, at),
      messages: { key: "messages/x.tar", bytes: 1, sha256: "def", messages, fetched: messages, missing: [] },
    });
    const previous = archive(100, "2026-10-18T03:00:00.000Z");
    expect(problems(archive(70), previous, {})).toEqual([
      "The messages' archive has 70 messages, down from 100 in the backup of 2026-10-18T03:00:00.000Z.",
    ]);
    expect(problems(archive(90), previous, {})).toEqual([]);
    // A backup from before there was an archive.
    expect(problems(archive(70), manifest({}), {})).toEqual([]);
  });
});
