"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui/Controls";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SaveState } from "@/components/ui/SaveState";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { AddResult } from "@/lib/server/politician-aliases";
import styles from "./AddAliasForm.module.css";

const copy = staffCopy.politician.aliases;

/** Adds an address to a politician's, saying how it went. */
export type AddAliasAction = (form: FormData) => Promise<AddResult | undefined> | AddResult | undefined | void;

/**
 * The form under a politician's aliases: adds an address to theirs, such as
 * a personal Gmail. Once the server has it, says it's added and that its
 * earlier mail will be found soon, or why it wasn't added; `onAdded` hears
 * the address added, for the list to draw the eye to it.
 */
export default function AddAliasForm({
  politicianId,
  action,
  onAdded,
}: {
  politicianId: number;
  action: AddAliasAction;
  onAdded?: (address: string) => void;
}) {
  const [result, setResult] = useState<AddResult | undefined>();
  const send = async (form: FormData) => {
    const answer = (await action(form)) ?? undefined;
    setResult(answer);
    if (answer?.added) onAdded?.(String(form.get("address")).trim().toLowerCase());
  };
  return (
    <>
      <FilterForm action={send} aria-label={copy.add} className={styles.form}>
        <input type="hidden" name="politicianId" value={politicianId} />
        <span className={styles.address}>
          <TextInput name="address" type="email" required aria-label={copy.address} placeholder={copy.address} />
        </span>
        <SubmitButton variant="primary" size="small" fit>
          {copy.add}
        </SubmitButton>
      </FilterForm>
      <p role="status" className={styles.result}>
        {result &&
          (result.added ? (
            <>
              <SaveState state="saved">{copy.added}</SaveState>
              <span className={styles.next}>
                <Muted>{copy.addedNext}</Muted>
              </span>
            </>
          ) : (
            <SaveState state="failed">{copy.refused[result.why]}</SaveState>
          ))}
      </p>
    </>
  );
}
