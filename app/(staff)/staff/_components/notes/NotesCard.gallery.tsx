// NotesCard in the component gallery (app/(tools)/gallery/), in the staff supporters group (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { NotesCardExample } from "./NotesCard.gallery.client";

export const notesCardGallery: Example[] = [
  {
    name: "NotesCard",
    file: "app/(staff)/staff/_components/notes/NotesCard.tsx",
    variants: [
      {
        label: "With Write a note, which drafts one at the top",
        render: () => (
          <StaffPage as="div">
            <NotesCardExample />
          </StaffPage>
        ),
      },
      {
        label: "No notes yet",
        render: () => (
          <StaffPage as="div">
            <NotesCardExample lines={false} />
          </StaffPage>
        ),
      },
      {
        label: "Without Write a note",
        render: () => (
          <StaffPage as="div">
            <NotesCardExample writable={false} />
          </StaffPage>
        ),
      },
    ],
  },
];
