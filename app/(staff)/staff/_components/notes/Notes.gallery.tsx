// Notes in the component gallery (app/(tools)/gallery/), in the staff supporters group (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { NoteEntryExample, NoteTextExample, NotesExample } from "./Notes.gallery.client";

export const notesGallery: Example[] = [
  {
    name: "Notes",
    file: "app/(staff)/staff/_components/notes/Notes.tsx",
    variants: [
      {
        label: "A supporter's notes card, as their writer sees them: her newest she can still change",
        render: () => (
          <StaffPage as="div">
            <NotesExample />
          </StaffPage>
        ),
      },
      {
        label: "As an admin, who can delete any",
        render: () => (
          <StaffPage as="div">
            <NotesExample as="admin" />
          </StaffPage>
        ),
      },
      {
        label: "None yet",
        render: () => (
          <StaffPage as="div">
            <NotesExample as="empty" />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "NoteEntry",
    file: "app/(staff)/staff/_components/notes/Notes.tsx",
    variants: [
      { label: "In a history: her own, which she can change", render: () => <NoteEntryExample /> },
      { label: "Someone else's, edited", render: () => <NoteEntryExample own={false} /> },
    ],
  },
  {
    name: "NoteText",
    file: "app/(staff)/staff/_components/notes/Notes.tsx",
    variants: [{ label: "With addresses, as links, on two lines", render: () => <NoteTextExample /> }],
  },
];
