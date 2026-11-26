"use client";

// ConditionMenu's examples, which log the condition chosen (ConditionMenu.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { MailingChoice } from "@/lib/mailings/fields";
import ConditionMenu from "./ConditionMenu";

/** An ask's answers, and events many enough to search, as a broadcast offers them. */
const conditions: MailingChoice[] = [
  {
    id: "frontier-ai-letter:signed",
    label: "signed the Frontier AI letter",
    covers: 12,
    group: "Frontier AI letter",
    option: "Signed",
  },
  {
    id: "event:pausecon",
    label: "registered for “PauseCon London”",
    covers: 41,
    group: "Registered for",
    option: "PauseCon London, 6 Feb 2027",
    searchable: true,
  },
  {
    id: "event:march",
    label: "registered for “March Against AI Extinction”",
    covers: 318,
    group: "Registered for",
    option: "March Against AI Extinction, 21 Nov 2026",
    searchable: true,
  },
];

export function ConditionMenuExample({ not = false }: { not?: boolean }) {
  return (
    <Logged>
      {(log) => <ConditionMenu not={not} conditions={conditions} recipients={412} choose={log("choose")} />}
    </Logged>
  );
}
