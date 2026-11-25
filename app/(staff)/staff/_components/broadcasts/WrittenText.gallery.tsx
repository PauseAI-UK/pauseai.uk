// WrittenText in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { exampleBroadcastText, examplePictureId, examplePlace, exampleTextWords } from "./BroadcastWriter.examples";
import WrittenText from "./WrittenText";

/** A text as written with a map and a button, and a second version for those who wrote, with a picture. */
const withVersion = {
  ...exampleBroadcastText,
  body: exampleTextWords,
  header: "location" as const,
  place: examplePlace,
  buttons: [{ text: "I'm coming" }],
  textVersion: {
    condition: "wrote:regulate-ai",
    body: exampleTextWords,
    templateId: null,
    header: "image" as const,
    place: null,
    pictureId: examplePictureId,
    buttons: [{ text: "Details", url: "https://pauseai.uk/march" }],
    template: null,
  },
};

export const writtenTextGallery: Example[] = [
  {
    name: "WrittenText",
    file: "app/(staff)/staff/_components/broadcasts/WrittenText.tsx",
    variants: [
      {
        label: "A text as written: everyone else's, with a toggle for its version for some",
        render: () => (
          <WrittenText written={withVersion} labels={{ "wrote:regulate-ai": "wrote to their MP" }} time="07:18" />
        ),
      },
      {
        label: "One with no version",
        render: () => <WrittenText written={exampleBroadcastText} labels={{}} time="07:18" />,
      },
    ],
  },
];
