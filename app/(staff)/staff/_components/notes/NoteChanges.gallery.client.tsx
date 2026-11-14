"use client";

// NoteChanges's examples, whose buttons are logged (NoteChanges.gallery.tsx).
import NoteChanges from "./NoteChanges";
import { NoteText } from "./Notes";
import { exampleNotes } from "./Notes.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A note's buttons, logged: Edit, which opens Save, Cancel and Delete, for its writer; Delete alone for an admin. */
export function NoteChangesExample({ editable = true }: { editable?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <NoteChanges
          note={exampleNotes[0]}
          editable={editable}
          text={<NoteText body={exampleNotes[0].body} />}
          meta="jo@pauseai.uk"
          edit={log("edit")}
          remove={log("delete")}
        />
      )}
    </Logged>
  );
}
