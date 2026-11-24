"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { isSaveKey, type DeleteNote, type EditNote } from "@/lib/notes/notes";
import { DeleteTwice } from "../ui/DeleteTwice";
import { Refusal, RefusedTextArea, ResultForm } from "../ui/ResultForm";
import styles from "./Notes.module.css";
import { notesCopy } from "./copy";

const copy = notesCopy.notes;

/** What the edit form says for each reason its action refuses it for, and Delete for its one. */
const EDIT_SAYS = { blank: copy.blank, gone: copy.gone.note, "too-late": copy.tooLate.edit };
const DELETE_SAYS = { "too-late": copy.tooLate.delete };

/**
 * A note that someone may change: `text`, and under it `meta`, who wrote
 * it and when, with its buttons at the right. Its writer, while they may
 * change it, has Edit, which puts the field, with its text, focused, in
 * place of the text, saved by Save or Ctrl+Enter (Cmd+Enter on a Mac), and
 * Save, Cancel and Delete, red, pressed twice, in
 * place of Edit; saving or cancelling puts the text back. Anyone else who
 * may delete it, an admin in that same day, has Delete alone. If the server
 * refuses, as it does once the day is up on a page left open, or for text
 * of nothing but spaces, it stays open and says why, under the field for an
 * edit and under Delete for that; and if saving fails, it stays open, with
 * what was typed, and says so. A note someone deleted meanwhile is said at
 * the page's top.
 */
export default function NoteChanges({
  note,
  editable,
  text,
  meta,
  edit,
  remove,
}: {
  note: { id: number; body: string };
  editable: boolean;
  text: ReactNode;
  meta: ReactNode;
  edit: EditNote;
  remove: DeleteNote;
}) {
  const [editing, setEditing] = useState(false);
  const id = `note-${note.id}-edit`;
  let buttons: ReactNode;
  if (!editable) {
    buttons = (
      <DeleteTwice name="id" value={String(note.id)} label={copy.delete} action={remove} says={DELETE_SAYS} short />
    );
  } else if (!editing) {
    // Keyed, as is Save, so the button clicked isn't reused as Save, a submit button, which the click would then send.
    buttons = (
      <Button key="edit" variant="ghost" size="small" fit type="button" onClick={() => setEditing(true)}>
        {copy.edit}
      </Button>
    );
  } else {
    buttons = (
      <>
        <Button key="save" variant="primary" size="small" fit type="submit" form={id}>
          {copy.save}
        </Button>
        <Button variant="ghost" size="small" fit type="button" onClick={() => setEditing(false)}>
          {copy.cancel}
        </Button>
        <DeleteTwice
          name="id"
          value={String(note.id)}
          label={copy.delete}
          action={remove}
          says={DELETE_SAYS}
          danger
          short
        />
      </>
    );
  }
  return (
    <div className={styles.note}>
      {editing ? (
        <ResultForm
          id={id}
          aria-label={copy.edit}
          action={edit}
          says={EDIT_SAYS}
          atTop={["gone"]}
          done={() => setEditing(false)}
        >
          <input type="hidden" name="id" value={note.id} />
          <RefusedTextArea
            name="body"
            defaultValue={note.body}
            required
            autoFocus
            aria-label={copy.note}
            rows={4}
            wrong={["blank"]}
            onKeyDown={(event) => {
              if (!isSaveKey(event)) return;
              event.preventDefault();
              event.currentTarget.form!.requestSubmit();
            }}
          />
          <Refusal />
        </ResultForm>
      ) : (
        text
      )}
      <div className={styles.meta}>
        {meta}
        <div className={styles.buttons}>{buttons}</div>
      </div>
    </div>
  );
}
