// TextTop in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { examplePictureId, examplePlace } from "./BroadcastWriter.examples";
import { TextTopExample } from "./TextTop.gallery.client";

export const textTopGallery: Example[] = [
  {
    name: "TextTop",
    file: "app/(staff)/staff/_components/broadcasts/TextTop.tsx",
    variants: [
      {
        label: "None, as the words have no link; choosing Place makes a map, or Picture a picture; find a place",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: null, place: null, pictureId: null }} />
          </StaffPage>
        ),
      },
      {
        label: "Its link's preview, once the words have a link",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: null, place: null, pictureId: null }} link="https://pauseai.uk/march" />
          </StaffPage>
        ),
      },
      {
        label: "A place chosen, its name and address to change",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: "location", place: examplePlace, pictureId: null }} />
          </StaffPage>
        ),
      },
      {
        label: "A picture chosen, with its × to take it off",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: "image", place: null, pictureId: examplePictureId }} />
          </StaffPage>
        ),
      },
      {
        label: "A chosen template's map: its kind fixed, its place not",
        render: () => (
          <StaffPage as="div">
            <TextTopExample initial={{ header: "location", place: examplePlace, pictureId: null }} fixed />
          </StaffPage>
        ),
      },
    ],
  },
];
