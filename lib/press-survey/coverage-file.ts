// Adds the survey's finds to lib/content/press-coverage.ts as text, so the
// rest of the file, its comments and its order, stay as people wrote them.
// An article joins its outlet's `articles`; an outlet the file hasn't got
// yet goes at the end of `OUTLETS`. Every value is written with
// JSON.stringify, so nothing from a headline can end a string early.

export type Addition = {
  outlet: string;
  title: string;
  url: string;
  date?: string;
  medium: "Article" | "Video" | "Photos";
  /** The comment above the entry: what connects it to us. */
  note: string;
};

/** `text` as `//` comment lines, each at most `width` characters after `indent`. */
export function commentLines(text: string, indent: string, width = 76): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(`${indent}// ${line}`);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  lines.push(`${indent}// ${line}`);
  return lines;
}

function article(addition: Addition, indent: string): string[] {
  const inner = `${indent}  `;
  return [
    `${indent}{`,
    ...commentLines(addition.note, inner),
    `${inner}title: ${JSON.stringify(addition.title)},`,
    `${inner}url: ${JSON.stringify(addition.url)},`,
    ...(addition.date ? [`${inner}date: ${JSON.stringify(addition.date)},`] : []),
    `${inner}medium: ${JSON.stringify(addition.medium)},`,
    `${indent}},`,
  ];
}

/**
 * `file` with `additions` added. `existing` names the outlets the file has,
 * as it spells them; an addition for any other outlet makes a new one.
 * Throws if the file isn't laid out as expected.
 */
export function addToCoverageFile(file: string, additions: Addition[], existing: string[]): string {
  const lines = file.split("\n");
  const start = lines.indexOf("export const OUTLETS: Outlet[] = [");
  const end = lines.indexOf("];", start);
  if (start === -1 || end === -1) throw new Error("Can't find OUTLETS in the coverage file");

  const byOutlet = Map.groupBy(additions, (addition) => addition.outlet);
  const newOutlets: string[] = [];
  // From the bottom up, so each insertion leaves the lines above it where they were.
  const inserts: { at: number; lines: string[] }[] = [];

  for (const [outlet, items] of byOutlet) {
    const rendered = items.flatMap((item) => article(item, "      "));
    if (!existing.includes(outlet)) {
      newOutlets.push("  {", `    name: ${JSON.stringify(outlet)},`, "    articles: [", ...rendered, "    ],", "  },");
      continue;
    }
    const name = lines.indexOf(`    name: ${JSON.stringify(outlet)},`, start);
    const close = lines.indexOf("    ],", name);
    if (name === -1 || name > end || close === -1 || close > end) {
      throw new Error(`Can't find ${outlet}'s articles in the coverage file`);
    }
    inserts.push({ at: close, lines: rendered });
  }
  inserts.push({ at: end, lines: newOutlets });

  for (const insert of inserts.sort((a, b) => b.at - a.at)) lines.splice(insert.at, 0, ...insert.lines);
  return lines.join("\n");
}
