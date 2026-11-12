import { describe, expect, it } from "vitest";
import { description, escapeMarkdown, weekSection, type Week } from "./report";

const week = (fields: Partial<Week>): Week => ({
  day: "2026-11-16",
  added: [],
  leads: [],
  setAside: [],
  notes: [],
  ...fields,
});

it("escapeMarkdown leaves no formatting, links, HTML or mentions", () => {
  expect(escapeMarkdown("[x](https://evil) <b> *a* @someone #1")).toBe(
    "\\[x\\]\\(https://evil\\) \\<b\\> \\*a\\* @​someone \\#1",
  );
});

describe("weekSection", () => {
  it("lists what was added, the leads, what was set aside and the notes", () => {
    const text = weekSection(
      week({
        added: [
          {
            outlet: "The Example Gazette",
            title: "Protesters march",
            url: "https://example.com/a",
            date: "2026-11-10",
            medium: "Article",
            note: "Quotes PauseAI UK.",
          },
        ],
        leads: [
          {
            title: "Maybe us",
            url: "https://example.com/b (1)",
            outlet: "example.com",
            why: "Patterns: PauseAI, not saying which.",
            others: ["https://example.org/b"],
          },
        ],
        setAside: [{ title: "Not us", url: "javascript:alert(1)", outlet: "example.net", why: "Patterns: none." }],
        notes: ["GDELT answered 429"],
      }),
    );
    expect(text).toContain("## Week of 2026-11-16");
    expect(text).toContain(
      "### Added to the file (1)\n\n- [Protesters march](https://example.com/a) (The Example Gazette, 2026-11-10): Quotes PauseAI UK.",
    );
    expect(text).toContain(
      "- [Maybe us](https://example.com/b%20%281%29) (example.com): Patterns: PauseAI, not saying which. Also at: <https://example.org/b>.",
    );
    expect(text).toContain("<details><summary>Set aside (1)</summary>\n\n- [Not us](#) (example.net): Patterns: none.");
    expect(text).toContain("### Notes\n\n- GDELT answered 429");
  });

  it("says None for an empty list, and leaves out empty extras", () => {
    const text = weekSection(week({}));
    expect(text.match(/None\./g)).toHaveLength(2);
    expect(text).not.toMatch(/Set aside|Notes/);
  });
});

describe("description", () => {
  it("puts the new week above the earlier ones", () => {
    const first = description(week({ day: "2026-11-09" }));
    expect(first.startsWith("<!-- press-survey -->")).toBe(true);
    const second = description(week({}), first);
    expect(second.indexOf("Week of 2026-11-16")).toBeLessThan(second.indexOf("Week of 2026-11-09"));
    expect(second.match(/<!-- press-survey -->/g)).toHaveLength(1);
    expect(description(week({}), "A description someone wrote")).toBe(description(week({})));
  });

  it("drops the oldest weeks to stay under the limit", () => {
    const earlier = description(week({ day: "2026-11-09" }), description(week({ day: "2026-11-02" })));
    const text = description(week({}), earlier, earlier.length + 100);
    expect(text).toContain("Week of 2026-11-16");
    expect(text).toContain("Week of 2026-11-09");
    expect(text).not.toContain("Week of 2026-11-02");
    expect(text).toContain("Earlier weeks are in this pull request's edit history.");
    expect(description(week({}), earlier, 10)).toContain("Week of 2026-11-16");
  });
});
