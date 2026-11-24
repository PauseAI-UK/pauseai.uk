"use client";

import { startTransition, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { staffMemberText } from "@/lib/staff-member";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import { isSaveKey, type AddNote } from "@/lib/notes/notes";
import Empty from "../ui/Empty";
import { Card } from "../ui/Grid";
import { Refusal, RefusedTextArea, ResultForm } from "../ui/ResultForm";
import styles from "./Notes.module.css";
import { notesCopy } from "./copy";

const copy = notesCopy.notes;

/** What the draft says for each reason its action refuses it for. */

/**
 * The notes card of a politician's or a supporter's page, its notes
 * (`children`, each an `li`) newest first, or a line saying there are none.
 * `target` is the hidden field that says whom they're about: `politicianId`
 * or `supporterId`, and the ID. With `add`, Write a note at its top right puts
 * a draft at the top: the field, focused, and under it the label and `writer`,
 * with Add note and Cancel at their right; on a supporter, a reminder under
 * the field of what a note about them should be. Ctrl+Enter, or Cmd+Enter on a
 * Mac, adds it too. Cancel takes the draft away; adding it does too, as the
 * page shows the note in its place, the two in one step. A draft of nothing
 * but spaces is refused under the field, and one for someone who has gone
 * meanwhile at the page's top. Without `add`, there's no button, so no
 * draft.
 */
export default function NotesCard({
  target,
  writer,
  add,
  children,
}: {
  target: { name: "supporterId" | "politicianId"; value: number };
  writer: string;
  add?: AddNote;
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
              <ResultForm
                className={styles.note}
                aria-label={copy.add}
                action={add!}
                says={{ blank: copy.blank, gone: guided ? copy.gone.supporter : copy.gone.politician }}
                atTop={["gone"]}
                // With the page's new notes, not before them: closed at once, the card would show
                // the notes it had for a moment, without the one just added.
                done={() => startTransition(() => setDrafting(false))}
              >
                <input type="hidden" name={target.name} value={target.value} />
                <RefusedTextArea
                  name="body"
                  required
                  autoFocus
                  aria-label={copy.note}
                  aria-describedby={guided ? "note-guidance" : undefined}
                  rows={3}
                  wrong={["blank"]}
                  onKeyDown={(event) => {
                    if (!isSaveKey(event)) return;
                    event.preventDefault();
                    event.currentTarget.form!.requestSubmit();
                  }}
                />
                <Refusal />
                {guided && (
                  <p id="note-guidance" className={styles.guidance}>
                    {copy.guidance}
                  </p>
                )}
                <div className={styles.meta}>
                  <Muted>{`${copy.kind} · ${staffMemberText(writer)}`}</Muted>
                  <div className={styles.buttons}>
                    <SubmitButton variant="primary" size="small" fit>
                      {copy.add}
                    </SubmitButton>
                    <Button variant="ghost" size="small" fit type="button" onClick={() => setDrafting(false)}>
                      {copy.cancel}
                    </Button>
                  </div>
                </div>
              </ResultForm>
            </li>
          )}
          {children}
        </ol>
      )}
    </Card>
  );
}
