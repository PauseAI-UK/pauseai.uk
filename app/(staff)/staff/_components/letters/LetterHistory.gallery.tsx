// LetterHistory in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import {
  exampleOlderRepliedLetterDetails,
  exampleRepliedLetterDetails,
  exampleSupporterLetterDetails,
} from "./LettersTable.examples";
import { historyOf, LetterHistory } from "./LetterHistory";
import StaffPage from "../ui/StaffPage";

export const letterHistoryGallery: Example[] = [
  {
    name: "LetterHistory",
    file: "app/(staff)/staff/_components/letters/LetterHistory.tsx",
    variants: [
      {
        label: "Nothing recorded yet",
        render: () => (
          <StaffPage as="div">
            <LetterHistory events={[]} />
          </StaffPage>
        ),
      },
      {
        label: "A supporter's letter copied from Airtable: when it was written, and sent, through Airtable",
        render: () => (
          <StaffPage as="div">
            <LetterHistory
              events={historyOf({
                ...exampleSupporterLetterDetails,
                backend: "airtable",
                createdAt: new Date("2026-09-30T18:00:00Z"),
                sentAt: new Date("2026-09-30T18:02:00Z"),
                events: [],
              })}
            />
          </StaffPage>
        ),
      },
      {
        label:
          "Replies: who each was to, and what was done with it; an automatic reply to the bounce address, and the sender's follow-up",
        render: () => (
          <StaffPage as="div">
            <LetterHistory events={historyOf(exampleRepliedLetterDetails)} />
          </StaffPage>
        ),
      },
      {
        label: "Replies recorded before what was done with them was: the forwards logged, one refused",
        render: () => (
          <StaffPage as="div">
            <LetterHistory events={historyOf(exampleOlderRepliedLetterDetails)} />
          </StaffPage>
        ),
      },
    ],
  },
];
