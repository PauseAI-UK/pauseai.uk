// A WhatsApp text that isn't really sent, as the fake (./whatsapp.ts)
// writes it to the outbox: a text file a person can read, which the
// storyboard reads back to picture the text as it arrives
// (tests/storyboard/whatsapp-steps.ts). Only what's sent is in it: a
// template's name and its fields' words, not the template's own words,
// which WhatsApp keeps; or words of our own.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A text in the outbox: to whom (+447…), and its template and fields, or its own words. */
export type OutboxText = { to: string } & (
  { template: { name: string; params: Record<string, string> } } | { words: string }
);

const HEAD = /^WhatsApp text from .+ to (\+\d+)$/;

/** A text as its file says it, from our number `from`. */
export function textNote(from: string, text: OutboxText): string {
  const head = `WhatsApp text from ${from} to ${text.to}`;
  if ("words" in text) return `${head}\n\n${text.words}\n`;
  const fields = Object.entries(text.template.params).map(([name, words]) => `  ${name}: ${words}\n`);
  return `${head}\nTemplate: ${text.template.name}\n${fields.join("")}`;
}

/** A text's file read back; undefined for another kind of file, such as a template sent for approval. */
export function readTextNote(note: string): OutboxText | undefined {
  const [head, second, ...rest] = note.split("\n");
  const to = HEAD.exec(head!)?.[1];
  if (!to) return undefined;
  if (second === "") return { to, words: rest.join("\n").trimEnd() };
  const fields = rest.filter((line) => line.startsWith("  ")).map((line) => /^ {2}(\w+): (.*)$/.exec(line)!);
  return {
    to,
    template: { name: second!.replace(/^Template: /, ""), params: Object.fromEntries(fields.map((m) => [m[1], m[2]])) },
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
