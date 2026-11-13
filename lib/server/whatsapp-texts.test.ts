import { expect, it } from "vitest";
import { query } from "@/lib/server/db";
import type { MailingDoc } from "@/lib/mailing-doc";
import { addFollower, EVENT_WORDS } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { createBroadcastDraft } from "./broadcast-drafts";
import {
  markUnreachable,
  metaName,
  paramName,
  templateParams,
  templateText,
  textResult,
  textsLeftToday,
  unreachable,
} from "./whatsapp-texts";

/** Words with both fields, each twice. */
const BOTH: MailingDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hi " },
        { type: "field", attrs: { field: "firstName" } },
        { type: "text", text: " (" },
        { type: "field", attrs: { field: "name" } },
        { type: "text", text: "), see you there, " },
        { type: "field", attrs: { field: "firstName" } },
        { type: "text", text: "." },
      ],
    },
  ],
};

it("names each field's parameter in WhatsApp's lower case", () => {
  expect(paramName("firstName")).toBe("first_name");
  expect(paramName("name")).toBe("name");
});

it("gives a text's words with each field as its parameter, and each field's words once", () => {
  expect(templateText(BOTH)).toBe("Hi {{first_name}} ({{name}}), see you there, {{first_name}}.");
  expect(templateParams(BOTH, { values: { firstName: "Jane", name: "Jane Smith" }, meets: [] })).toEqual([
    { name: "first_name", text: "Jane" },
    { name: "name", text: "Jane Smith" },
  ]);
  // One with no value has none to give.
  expect(templateParams(EVENT_WORDS, { values: {}, meets: [] })).toEqual([{ name: "first_name", text: "" }]);
});

it("names a template for WhatsApp by its own name and its ID", () => {
  expect(metaName("March day: where to meet!", 7)).toBe("march_day_where_to_meet_7");
  expect(metaName("Café", 8)).toBe("cafe_8");
  expect(metaName("!!!", 9)).toBe("text_9");
});

it("keeps what WhatsApp said of a send", () => {
  expect(textResult({ sent: true, id: "wamid.1" })).toEqual({ sent: true, id: "wamid.1" });
  const refused = (code: number | null) => textResult({ sent: false, code, reason: "No" });
  expect(refused(131026)).toEqual({ sent: false, reason: "unreachable" });
  expect(refused(131050)).toEqual({ sent: false, reason: "stopped" });
  expect(refused(131049)).toEqual({ sent: false, reason: "held" });
  expect(refused(130429)).toEqual({ sent: false, reason: "failed", retry: true });
  expect(refused(132015)).toEqual({ sent: false, reason: "failed", retry: true });
  expect(refused(131000)).toEqual({ sent: false, reason: "failed" });
  expect(refused(null)).toEqual({ sent: false, reason: "failed" });
});

describeWithDatabase("numbers WhatsApp can't reach, and the daily limit", () => {
  useTestDatabase();

  it("marks a number not on WhatsApp once, by the newest copy to find it", async () => {
    const supporter = await addFollower("usr-1", "jane@example.com", "Jane", { phone: "+447700900001" });
    const text = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    const [first, second] = await query<{ id: number }>(
      `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status) VALUES ($1, $2, '+447700900001', 'sent'),
         ($3, $2, '+447700900001', 'sent') RETURNING id::int AS id`,
      [text, supporter, (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!],
    );
    await markUnreachable("+447700900001", first.id);
    await markUnreachable("+447700900001", second.id);
    expect(await query("SELECT number, message_id::int AS copy FROM whatsapp_unreachable")).toEqual([
      { number: "+447700900001", copy: second.id },
    ]);
    expect(await unreachable(["+447700900001", "+447700900002"])).toEqual(new Set(["+447700900001"]));
  });

  it("counts the people texted in the last day against the limit, or none for no limit", async () => {
    expect(await textsLeftToday(null)).toBeNull();
    const supporter = await addFollower("usr-1", "jane@example.com", "Jane", { phone: "+447700900001" });
    const text = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    await query(
      `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, sent_at)
       VALUES ($1, $2, '+447700900001', 'sent', now() - interval '1 hour')`,
      [text, supporter],
    );
    expect(await textsLeftToday(250)).toBe(249);
    expect(await textsLeftToday(1)).toBe(0);
    expect(await textsLeftToday(0)).toBe(0);
  });
});
