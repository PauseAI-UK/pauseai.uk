// AnswerWord in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import AnswerWord from "./AnswerWord";

export const answerWordGallery: Example[] = [
  {
    name: "AnswerWord",
    file: "app/(staff)/staff/_components/asks/AnswerWord.tsx",
    variants: [
      {
        label: "A yes, a no, and one in between",
        render: () => (
          <div style={{ display: "grid" }}>
            <AnswerWord status="signed" />
            <AnswerWord status="declined" />
            <AnswerWord status="other" />
          </div>
        ),
      },
      {
        label: "Asked with no answer yet, and never asked: for a letter, then an event",
        render: () => (
          <div style={{ display: "grid" }}>
            <AnswerWord status="invited" kind="letter" />
            <AnswerWord status={null} kind="letter" />
            <AnswerWord status="invited" kind="event" />
            <AnswerWord status={null} kind="event" />
          </div>
        ),
      },
    ],
  },
];
