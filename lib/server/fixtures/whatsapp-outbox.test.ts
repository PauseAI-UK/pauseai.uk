import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readTextNote, readTexts, textNote, type OutboxText } from "./whatsapp-outbox";

const onTemplate: OutboxText = {
  to: "+447700900001",
  template: { name: "march_day_1", params: { first_name: "Jane", name: "Jane Smith" } },
};
const ownWords: OutboxText = { to: "+447700900001", words: "Yes, there's a lift.\n\nBy the main doors." };

it("writes a text as a person can read it, and reads it back", () => {
  expect(textNote("+44 7700 900000", onTemplate)).toBe(
    "WhatsApp text from +44 7700 900000 to +447700900001\nTemplate: march_day_1\n  first_name: Jane\n  name: Jane Smith\n",
  );
  expect(readTextNote(textNote("+44 7700 900000", onTemplate))).toEqual(onTemplate);
  expect(readTextNote(textNote("+44 7700 900000", ownWords))).toEqual(ownWords);
  // A template sent for approval isn't a text.
  expect(readTextNote("WhatsApp template sent for approval: march_day_1\n\nHi\n")).toBeUndefined();
});

it("reads every text in the outbox, oldest first, passing over emails and templates, and none where there's no outbox", () => {
  const dir = mkdtempSync(join(tmpdir(), "whatsapp-texts-"));
  try {
    writeFileSync(join(dir, "1-0001.txt"), textNote("+44 7700 900000", onTemplate));
    writeFileSync(join(dir, "1-0002.eml"), "Subject: an email\r\n\r\nHi");
    writeFileSync(join(dir, "1-0003.txt"), "WhatsApp template sent for approval: march_day_1\n\nHi\n");
    writeFileSync(join(dir, "1-0004.txt"), textNote("+44 7700 900000", ownWords));
    expect(readTexts(dir)).toEqual([onTemplate, ownWords]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  expect(readTexts(join(dir, "gone"))).toEqual([]);
});
