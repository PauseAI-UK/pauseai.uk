// NoteChanges in the component gallery (app/(tools)/gallery/), in the staff supporters group (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { NoteChangesExample } from "./NoteChanges.gallery.client";

export const noteChangesGallery: Example[] = [
  {
    name: "NoteChanges",
    file: "app/(staff)/staff/_components/notes/NoteChanges.tsx",
    variants: [
      { label: "Its writer's: Edit, which opens Save, Cancel and Delete", render: () => <NoteChangesExample /> },
      { label: "An admin's, on someone else's: Delete alone", render: () => <NoteChangesExample editable={false} /> },
    ],
  },
];
