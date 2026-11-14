"use client";

// MailingEditor's examples, a letter whose changes show beside it (MailingEditor.gallery.tsx).
import type { JSONContent } from "@tiptap/react";
import { useId } from "react";
import MailingEditor from "./MailingEditor";
import { Controlled } from "@/app/(tools)/gallery/_components/wiring";

/** The merge fields and who a part can be for, as a mailing to politicians offers them: two lords have no constituency. */
const mailingFields = [
  { id: "salutation", label: "salutation", lacking: 0 },
  { id: "name", label: "name", lacking: 0 },
  { id: "constituency", label: "constituency", lacking: 2 },
];

const mailingConditions = [
  {
    id: "frontier-ai-letter:signed",
    label: "signed the Frontier AI letter",
    covers: 12,
    group: "Frontier AI letter",
    option: "Signed",
  },
  {
    id: "edinburgh-conference-2026:going",
    label: "are going to the Edinburgh conference",
    covers: 3,
    group: "Edinburgh conference",
    option: "Going",
  },
  {
    id: "edinburgh-conference-2026:declined",
    label: "declined the Edinburgh conference",
    covers: 5,
    group: "Edinburgh conference",
    option: "Declined",
  },
];

/** An invitation with a salutation, and a thank-you only for those who signed. */
const mailingLetter: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Dear " },
        { type: "field", attrs: { field: "salutation" } },
        { type: "text", text: "," },
      ],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "I'm writing to invite you to our conference on AI safety in Edinburgh." }],
    },
    {
      type: "onlyFor",
      attrs: { condition: "frontier-ai-letter:signed" },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Thank you again for signing our open letter to the Prime Minister." }],
        },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "Yours sincerely," }] },
  ],
};

export function MailingEditorExample() {
  const label = useId();
  return (
    <Controlled initial={mailingLetter} show={(doc) => JSON.stringify(doc)}>
      {(value, set) => (
        <>
          <p id={label}>Letter</p>
          <MailingEditor
            initial={value}
            onChange={set}
            fields={mailingFields}
            conditions={mailingConditions}
            labelledBy={label}
          />
        </>
      )}
    </Controlled>
  );
}
