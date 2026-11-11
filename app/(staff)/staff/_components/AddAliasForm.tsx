"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui/Controls";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorText, Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { AddResult } from "@/lib/server/politician-aliases";
import styles from "./AddAliasForm.module.css";

const copy = staffCopy.politician.aliases;

/**
 * The form under a politician's aliases: adds an address to theirs, such as
 * a personal Gmail. Once the server has it, says how many messages the
 * mailboxes held with it, or why it wasn't added.
 */
export default function AddAliasForm({
  politicianId,
  action,
}: {
  politicianId: number;
  action: (form: FormData) => Promise<AddResult | undefined> | AddResult | undefined | void;
}) {
  const [result, setResult] = useState<AddResult | undefined>();
  const send = async (form: FormData) => setResult((await action(form)) ?? undefined);
  return (
    <>
      <FilterForm action={send} aria-label={copy.add} className={styles.form}>
        <input type="hidden" name="politicianId" value={politicianId} />
        <span className={styles.address}>
          <TextInput name="address" type="email" required aria-label={copy.address} placeholder={copy.address} />
        </span>
        <SubmitButton variant="ghost" size="small" fit>
          {copy.add}
        </SubmitButton>
      </FilterForm>
      <p role="status" className={styles.result}>
        {result &&
          (result.added ? <Muted>{copy.added(result.kept)}</Muted> : <ErrorText>{copy.refused[result.why]}</ErrorText>)}
      </p>
    </>
  );
}
