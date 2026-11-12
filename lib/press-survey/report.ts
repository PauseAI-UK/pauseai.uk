// The survey's pull request description. Each run adds a section for its
// week at the top, above the weeks before it, so one open pull request
// gathers every week until a person merges or closes it. Headlines come
// from the web, so they're escaped: no links, mentions or HTML of their own.

import type { Addition } from "./coverage-file.ts";

/** A find that isn't in the file: to check by hand, or set aside, and why. */
export type Listed = { title: string; url: string; outlet: string; date?: string; why: string; others?: string[] };

export type Week = {
  /** YYYY-MM-DD the run began. */
  day: string;
  added: Addition[];
  leads: Listed[];
  setAside: Listed[];
  /** What went wrong or was skipped: a search that failed, no model. */
  notes: string[];
};

const MARK = "<!-- press-survey week -->";

const INTRO = [
  "<!-- press-survey -->",
  "The weekly press survey's finds for `lib/content/press-coverage.ts`, from GDELT and Google News (`.github/workflows/press-survey.yml`).",
  "",
  "Nothing here is checked until a person has opened each page and read it, by the rules at the top of the file. Edit or delete entries on this branch as needed, then mark it ready for review, which runs CI, and merge. The next run adds to this pull request while it's open.",
].join("\n");

/** `text` safe to show as Markdown: no formatting, links, HTML or @mentions of its own. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()<>#+!|~]/g, "\\$&").replace(/@/g, "@\u200b");
}

/** `url` as a Markdown link target: http(s) only, with nothing that would end the link. */
function target(url: string): string {
  const escaped = (character: string) => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;
  return /^https?:\/\//.test(url) ? url.replace(/[()<>\s]/g, escaped) : "#";
}

function item({ title, url, outlet, date, why, others = [] }: Listed): string {
  const when = date ? `, ${date}` : "";
  const copies = others.length > 0 ? ` Also at: ${others.map((other) => `<${target(other)}>`).join(", ")}.` : "";
  return `- [${escapeMarkdown(title)}](${target(url)}) (${escapeMarkdown(outlet)}${when}): ${escapeMarkdown(why)}${copies}`;
}

/** One week's section. */
export function weekSection(week: Week): string {
  const added = week.added.map((addition) =>
    item({
      title: addition.title,
      url: addition.url,
      outlet: addition.outlet,
      date: addition.date,
      why: addition.note,
    }),
  );
  return [
    MARK,
    `## Week of ${week.day}`,
    "",
    `### Added to the file (${week.added.length})`,
    "",
    ...(added.length > 0 ? added : ["None."]),
    "",
    `### Leads to check (${week.leads.length})`,
    "",
    "Not in the file: each might belong, but the survey couldn't tell. Add one by hand if it does.",
    "",
    ...(week.leads.length > 0 ? week.leads.map(item) : ["None."]),
    "",
    ...(week.setAside.length > 0
      ? [
          `<details><summary>Set aside (${week.setAside.length})</summary>`,
          "",
          ...week.setAside.map(item),
          "",
          "</details>",
          "",
        ]
      : []),
    ...(week.notes.length > 0 ? ["### Notes", "", ...week.notes.map((note) => `- ${escapeMarkdown(note)}`), ""] : []),
  ].join("\n");
}

/** GitHub's limit on a description is 65,536 characters; this leaves room. */
const MOST_CHARACTERS = 60_000;

/**
 * The description with `week` added above the weeks already in `previous`
 * (a description this wrote), if any, dropping the oldest weeks to keep
 * under `most` characters.
 */
export function description(week: Week, previous = "", most = MOST_CHARACTERS): string {
  const earlier = previous.split(MARK).slice(1);
  const weeks = [weekSection(week), ...earlier.map((section) => `${MARK}${section.trimEnd()}\n`)];
  let text = `${INTRO}\n\n${weeks.join("\n")}`;
  while (text.length > most && weeks.length > 1) {
    weeks.pop();
    text = `${INTRO}\n\n${weeks.join("\n")}\n_Earlier weeks are in this pull request's edit history._\n`;
  }
  return text;
}
