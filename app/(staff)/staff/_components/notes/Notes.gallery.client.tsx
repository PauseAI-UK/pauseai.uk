"use client";

// Notes's examples, whose forms are logged (Notes.gallery.tsx).
import Notes, { NoteEntry, NoteText } from "./Notes";
import { exampleNoteAdmin, exampleNotes, exampleNotesAt, exampleNoteWriter } from "./Notes.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/**
 * A supporter's notes, their forms logged, as Jo sees them, who can change
 * her newest; as an admin, who can delete any; or with none yet.
 */
export function NotesExample({ as = "writer" }: { as?: "writer" | "admin" | "empty" }) {
  return (
    <Logged>
      {(log) => (
        <Notes
          supporterId={1}
          notes={as === "empty" ? [] : exampleNotes}
          reader={as === "admin" ? exampleNoteAdmin : exampleNoteWriter}
          at={exampleNotesAt}
          add={log("add")}
          edit={log("edit")}
          remove={log("delete")}
        />
      )}
    </Logged>
  );
}

/** One note as a history shows it, labelled and without its time: Jo's, which she can change, or Sam's, edited, which she can't. */
export function NoteEntryExample({ own = true }: { own?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <NoteEntry
          note={exampleNotes[own ? 0 : 1]}
          reader={exampleNoteWriter}
          at={exampleNotesAt}
          edit={log("edit")}
          remove={log("delete")}
          label="Note"
          dated={false}
        />
      )}
    </Logged>
  );
}

/** A note's text, its addresses links, and its lines kept. */
export function NoteTextExample() {
  return <NoteText body={exampleNotes[0].body + "\n" + exampleNotes[1].body} />;
}
