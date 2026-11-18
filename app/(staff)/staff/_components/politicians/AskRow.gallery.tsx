// AskRow in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { AskRowExample } from "./AskRow.gallery.client";

export const askRowGallery: Example[] = [
  {
    name: "AskRow",
    file: "app/(staff)/staff/_components/politicians/AskRow.tsx",
    variants: [
      {
        label: "An answer from Airtable, and an ask staff record they were never asked",
        render: () => <AskRowExample />,
      },
      { label: "A letter they declined, crossed", render: () => <AskRowExample declined /> },
      {
        label: "No answer yet: an event a letter invited them to, and a letter staff marked them asked to sign",
        render: () => <AskRowExample invited />,
      },
    ],
  },
  {
    name: "AskRows",
    file: "app/(staff)/staff/_components/politicians/AskRow.tsx",
    variants: [{ label: "Rows of asks, their answers lined up in a column", render: () => <AskRowExample /> }],
  },
  {
    name: "PoliticianAsks",
    file: "app/(staff)/staff/_components/politicians/AskRow.tsx",
    variants: [
      {
        label: "A politician's asks: those answered, in order, and the button for another",
        render: () => <AskRowExample others />,
      },
    ],
  },
];
