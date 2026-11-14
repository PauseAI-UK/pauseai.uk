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
        label: "A yes, a no, one in between, and none",
        render: () => (
          <div style={{ display: "grid" }}>
            <AnswerWord status="signed" />
            <AnswerWord status="declined" />
            <AnswerWord status="other" />
            <AnswerWord status={null} />
          </div>
        ),
      },
    ],
  },
];
