// A WhatsApp text that isn't really sent, as the fake (./whatsapp.ts)
// writes it to the outbox: a text file a person can read, which the
// storyboard reads back to picture the text as it arrives
// (tests/storyboard/whatsapp-steps.ts). Only what's sent is in it: a
// template's name and its fields' words, not the template's own words,
// which WhatsApp keeps; or words of our own.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The place a text's map shows. */
export type OutboxPlace = { name: string; address: string; latitude: number; longitude: number };

/** A text in the outbox: to whom (+447…), and its template, its place or picture if it has one, and fields; or its own words. */
export type OutboxText = { to: string } & (
  | { template: { name: string; params: Record<string, string>; place?: OutboxPlace; picture?: string } }
  | { words: string }
);

/** A place's name with its point, then its address on the next line, so a comma in either is its own. */
const PLACE = /^Place: (.*) \((-?[\d.]+), (-?[\d.]+)\)$/;
const ADDRESS = "Address: ";

const HEAD = /^WhatsApp text from .+ to (\+\d+)$/;

/** A text as its file says it, from our number `from`. */
export function textNote(from: string, text: OutboxText): string {
  const head = `WhatsApp text from ${from} to ${text.to}`;
  if ("words" in text) return `${head}\n\n${text.words}\n`;
  const fields = Object.entries(text.template.params).map(([name, words]) => `  ${name}: ${words}\n`);
  const { place } = text.template;
  const where = place
    ? `Place: ${place.name} (${place.latitude}, ${place.longitude})\n${ADDRESS}${place.address}\n`
    : "";
  const picture = text.template.picture ? `Picture: ${text.template.picture}\n` : "";
  return `${head}\nTemplate: ${text.template.name}\n${where}${picture}${fields.join("")}`;
}

/** A text's file read back; undefined for another kind of file, such as a template sent for approval. */
export function readTextNote(note: string): OutboxText | undefined {
  const [head, second, ...rest] = note.split("\n");
  const to = HEAD.exec(head!)?.[1];
  if (!to) return undefined;
  if (second === "") return { to, words: rest.join("\n").trimEnd() };
  const fields = rest.filter((line) => line.startsWith("  ")).map((line) => /^ {2}(\w+): (.*)$/.exec(line)!);
  const where = rest.map((line) => PLACE.exec(line)).find(Boolean);
  const address = rest.find((line) => line.startsWith(ADDRESS))?.slice(ADDRESS.length);
  const picture = rest.find((line) => line.startsWith("Picture: "))?.slice("Picture: ".length);
  const params = Object.fromEntries(fields.map((m) => [m[1], m[2]]));
  const name = second!.replace(/^Template: /, "");
  const shown = picture ? { picture } : {};
  return {
    to,
    template: where
      ? {
          name,
          params,
          place: { name: where[1], address: address!, latitude: Number(where[2]), longitude: Number(where[3]) },
        }
      : { name, params, ...shown },
  };
}

/** Every text in the outbox `dir`, oldest first. */
export function readTexts(dir: string): OutboxText[] {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((file) => file.endsWith(".txt"))
      .sort();
  } catch {
    return [];
  }
  return files.flatMap((file) => readTextNote(readFileSync(join(dir, file), "utf8")) ?? []);
}
