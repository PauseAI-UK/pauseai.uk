"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui/Controls";
import { Field, FieldGroup, Hint } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorText, Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { EditResult } from "@/lib/server/politician-edits";
import styles from "./EditPoliticianForm.module.css";

const copy = staffCopy.politician.editDetails;

/**
 * What staff keep by hand of a politician's: their salutation, and a Lord's
 * email (`ownEmail`), as everyone else's comes from their body. Once the
 * server has it, says it's saved, or why not.
 */
export default function EditPoliticianForm({
  politician,
  ownEmail,
  action,
}: {
  politician: { id: number; salutation: string; email: string | null };
  ownEmail: boolean;
  action: (form: FormData) => Promise<EditResult | undefined> | EditResult | undefined | void;
}) {
  const [result, setResult] = useState<EditResult | undefined>();
  const send = async (form: FormData) => setResult((await action(form)) ?? undefined);
  return (
    <FormStack action={send} aria-label={copy.title}>
      <input type="hidden" name="politicianId" value={politician.id} />
      <Field label={copy.salutation}>
        <TextInput name="salutation" required defaultValue={politician.salutation} />
      </Field>
      {ownEmail && (
        <FieldGroup>
          <Field label={copy.email}>
            <TextInput name="email" type="email" defaultValue={politician.email ?? ""} aria-describedby="email-hint" />
          </Field>
          <Hint id="email-hint">{copy.emailHint}</Hint>
        </FieldGroup>
      )}
      <div className={styles.actions}>
        <SubmitButton variant="primary" size="small">
          {copy.save}
        </SubmitButton>
        <span role="status">
          {result && (result.saved ? <Muted>{copy.saved}</Muted> : <ErrorText>{copy.refused[result.why]}</ErrorText>)}
        </span>
      </div>
    </FormStack>
  );
}
