"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorText } from "@/components/ui/Text";
import type { AddResult } from "@/lib/politicians/aliases.server";
import styles from "./AddAliasForm.module.css";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician.aliases;

/** Adds an address to a politician's, saying how it went. */
export type AddAliasAction = (form: FormData) => Promise<AddResult | undefined> | AddResult | undefined | void;

/**
 * Under a politician's aliases, an Add that opens the form to add an address
 * to theirs, such as a personal Gmail, with a note of why, which must be
 * filled. Once the server has it, says why it wasn't added, if it wasn't.
 * Added, the form folds back to its Add: `onAdded` hears the address, for
 * the list to show it and draw the eye to it.
 */
export default function AddAliasForm({
  politicianId,
  action,
  onAdded,
  first = false,
}: {
  politicianId: number;
  action: AddAliasAction;
  onAdded?: (address: string) => void;
  /** No addresses above it yet, so it sits close under what's there. */
  first?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AddResult | undefined>();
  const send = async (form: FormData) => {
    const answer = (await action(form)) ?? undefined;
    setResult(answer);
    if (answer?.added) {
      setOpen(false);
      onAdded?.(String(form.get("address")).trim().toLowerCase());
    }
  };
  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        size="small"
        fit
        className={first ? undefined : styles.open}
        onClick={() => setOpen(true)}
      >
        {copy.add}
      </Button>
    );
  return (
    <>
      <FilterForm action={send} aria-label={copy.add} className={first ? undefined : styles.form}>
        <input type="hidden" name="politicianId" value={politicianId} />
        <span className={styles.address}>
          <TextInput name="address" type="email" required aria-label={copy.address} placeholder={copy.address} />
        </span>
        <span className={styles.note}>
          <TextInput name="note" required aria-label={copy.note} placeholder={copy.notePlaceholder} />
        </span>
        <SubmitButton variant="primary" size="small" fit>
          {copy.add}
        </SubmitButton>
      </FilterForm>
      <p role="status" className={styles.result}>
        {result && !result.added && <ErrorText>{copy.refused[result.why]}</ErrorText>}
      </p>
    </>
  );
}
