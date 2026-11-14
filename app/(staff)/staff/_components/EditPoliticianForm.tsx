"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { SubmitButton } from "@/components/ui/SubmitButton";
import Tag from "@/components/ui/Tag";
import { ErrorText, Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { EditResult } from "@/lib/server/politician-edits";
import styles from "./EditPoliticianForm.module.css";

const copy = staffCopy.politician.editDetails;

type Action = (form: FormData) => Promise<EditResult | undefined> | EditResult | undefined | void;

/**
 * One of what staff keep by hand of a politician's, with its Edit: their
 * `salutation`, as a letter to them starts, tagged when it's ours by rule
 * without their gender, to check; or a Lord's `email`, as most Lords list
 * none of their own. Given `action`, Edit turns it into a short field with
 * Save and Cancel; once the server has it, it says it's saved, or the field
 * why not. Without one, it's shown as it is.
 */
export default function EditPoliticianForm({
  politician,
  field,
  action,
}: {
  politician: { id: number; salutation: string; salutationToCheck: boolean; email: string | null };
  field: "salutation" | "email";
  action?: Action;
}) {
  return field === "salutation" ? (
    <Line
      label={copy.salutation}
      name="salutation"
      value={politician.salutation}
      shown={
        <>
          <span>
            {copy.lettersStart} <strong>{copy.dear(politician.salutation || copy.none)}</strong>
          </span>
          {politician.salutationToCheck && <Tag tone="amber">{staffCopy.politician.salutationToCheck}</Tag>}
        </>
      }
      hidden={{ politicianId: politician.id }}
      action={action}
    />
  ) : (
    <Line
      label={copy.email}
      name="email"
      type="email"
      value={politician.email ?? ""}
      shown={politician.email ?? <Muted>{staffCopy.politicians.noEmail}</Muted>}
      hidden={{ politicianId: politician.id, salutation: politician.salutation }}
      hint={copy.emailHint}
      action={action}
    />
  );
}

/**
 * What we write with, and an Edit button that swaps it for a field, sent
 * with `hidden`.
 */
function Line({
  label,
  name,
  type = "text",
  value,
  shown,
  hidden,
  hint,
  action,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  shown: ReactNode;
  hidden: Record<string, string | number>;
  hint?: string;
  action?: Action;
}) {
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<EditResult | undefined>();
  const send = async (form: FormData) => {
    const answer = (await action!(form)) ?? undefined;
    setResult(answer);
    if (answer?.saved) setEditing(false);
  };
  return (
    <div className={styles.line}>
      {editing ? (
        <form action={send} aria-label={`${copy.edit} ${label}`} className={styles.form}>
          {Object.entries(hidden).map(([key, v]) => (
            <input key={key} type="hidden" name={key} value={v} />
          ))}
          <span className={styles.field}>
            <TextInput
              name={name}
              type={type}
              required={name === "salutation"}
              defaultValue={value}
              aria-label={label}
              autoFocus
            />
          </span>
          <SubmitButton variant="primary" size="small" fit>
            {copy.save}
          </SubmitButton>
          <Button variant="ghost" size="small" fit type="button" onClick={() => setEditing(false)}>
            {copy.cancel}
          </Button>
        </form>
      ) : (
        <span className={styles.value}>
          {shown}
          {action && (
            <Button
              variant="ghost"
              size="small"
              fit
              type="button"
              aria-label={`${copy.edit} ${label}`}
              onClick={() => {
                setResult(undefined);
                setEditing(true);
              }}
            >
              {copy.edit}
            </Button>
          )}
        </span>
      )}
      <span role="status" className={styles.status}>
        {result && (result.saved ? <Muted>{copy.saved}</Muted> : <ErrorText>{copy.refused[result.why]}</ErrorText>)}
      </span>
      {editing && hint && (
        <span className={styles.hint}>
          <Muted>{hint}</Muted>
        </span>
      )}
    </div>
  );
}
