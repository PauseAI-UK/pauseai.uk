// PoliticianMarks in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { PoliticianMarksExample } from "./PoliticianMarks.gallery.client";

export const politicianMarksGallery: Example[] = [
  {
    name: "PoliticianMarks",
    file: "app/(staff)/staff/_components/politicians/PoliticianMarks.tsx",
    variants: [
      { label: "One marker on, one off", render: () => <PoliticianMarksExample /> },
      { label: "A test politician's", render: () => <PoliticianMarksExample test /> },
    ],
  },
];
