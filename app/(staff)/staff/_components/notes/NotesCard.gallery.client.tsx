"use client";

// NotesCard's examples, whose Write a note is logged (NotesCard.gallery.tsx).
import NotesCard from "./NotesCard";
import { exampleNoteWriter } from "./Notes.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A politician's history card, its Write a note logged: two lines, or none; or without Write a note. */
export function NotesCardExample({ lines = true, writable = true }: { lines?: boolean; writable?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <NotesCard
          target={{ name: "politicianId", value: 7 }}
          writer={exampleNoteWriter.email}
          add={writable ? log("add") : undefined}
        >
          {(lines ? ["Met them at the fair", "Asked for the one-pager"] : []).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </NotesCard>
      )}
    </Logged>
  );
}
