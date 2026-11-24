// TextTop in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { examplePlace } from "./BroadcastWriter.examples";
import { TextTopExample } from "./TextTop.gallery.client";

export const textTopGallery: Example[] = [
  {
    name: "TextTop",
    file: "app/(staff)/staff/_components/broadcasts/TextTop.tsx",
    variants: [
      {
        label: "Its link's card, which choosing Place makes a map; find a place, and choose from two",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: null, place: null }} />
          </StaffPage>
        ),
      },
      {
        label: "A place chosen, its name and address to change",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: "location", place: examplePlace }} />
          </StaffPage>
        ),
      },
      {
        label: "A chosen template's map: its kind fixed, its place not",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: "location", place: examplePlace }} fixed />
          </StaffPage>
        ),
      },
    ],
  },
];
