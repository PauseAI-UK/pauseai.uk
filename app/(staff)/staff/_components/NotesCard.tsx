"use client";

import { startTransition, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Controls";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { isSaveKey } from "@/lib/notes";
import Empty from "./ui/Empty";
import { Card } from "./ui/Grid";
import styles from "./Notes.module.css";

const copy = staffCopy.notes;

/**
 * The notes card of a politician's or a supporter's page, its notes
 * (`children`, each an `li`) newest first, or a line saying there are none.
 * `target` is the hidden field that says whom they're about: `politicianId`
 * or `supporterId`, and the ID. With `add`, Write a note at its top right puts
 * a draft at the top: the field, focused, and under it the label and `writer`,
 * with Add note and Cancel at their right; on a supporter, a reminder under
 * the field of what a note about them should be. Ctrl+Enter, or Cmd+Enter on a
 * Mac, adds it too. Cancel takes the draft away; adding it does too, as the
 * page shows the note in its place, the two in one step. Without `add`,
 * there's no button, so no draft.
 */
export default function NotesCard({
  target,
  writer,
  add,
  children,
}: {
  target: { name: "supporterId" | "politicianId"; value: number };
  writer: string;
  add?: (form: FormData) => void | Promise<void>;
  children: ReactNode[];
}) {
  const [drafting, setDrafting] = useState(false);
  const guided = target.name === "supporterId";
  return (
    <Card
      look="aside"
      title={copy.title}
      id="notes-title"
      action={
        add &&
        !drafting && (
          <Button variant="ghost" size="small" fit type="button" onClick={() => setDrafting(true)}>
            {copy.write}
          </Button>
        )
      }
    >
      {children.length === 0 && !drafting ? (
        <Empty>{copy.none}</Empty>
      ) : (
        <ol className={styles.notes} aria-labelledby="notes-title">
          {drafting && (
            <li>
              <form
                className={styles.note}
                aria-label={copy.add}
                action={async (form) => {
                  await add!(form);
                  // With the page's new notes, not before them: closed at once, the card would show
                  // the notes it had for a moment, without the one just added.
                  startTransition(() => setDrafting(false));
                }}
              >
                <input type="hidden" name={target.name} value={target.value} />
                <TextArea
                  name="body"
                  required
                  autoFocus
                  aria-label={copy.note}
                  aria-describedby={guided ? "note-guidance" : undefined}
                  rows={3}
                  onKeyDown={(event) => {
                    if (!isSaveKey(event)) return;
                    event.preventDefault();
                    event.currentTarget.form!.requestSubmit();
                  }}
                />
                {guided && (
                  <p id="note-guidance" className={styles.guidance}>
                    {copy.guidance}
                  </p>
                )}
                <div className={styles.meta}>
                  <Muted>{`${staffCopy.politician.history.note} · ${writer}`}</Muted>
                  <div className={styles.buttons}>
                    <SubmitButton variant="primary" size="small" fit>
                      {copy.add}
                    </SubmitButton>
                    <Button variant="ghost" size="small" fit type="button" onClick={() => setDrafting(false)}>
                      {copy.cancel}
                    </Button>
                  </div>
                </div>
              </form>
            </li>
          )}
          {children}
        </ol>
      )}
    </Card>
  );
}
