"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
// A row of fields along their bottoms, as a FilterForm lays them out.
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormResult } from "@/lib/form-result";
import type { AddRefusal } from "@/lib/politicians/aliases.server";
import { Refusal, RefusedTextInput, ResultForm } from "../ui/ResultForm";
import styles from "./AddAliasForm.module.css";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician.aliases;

/** Adds an address to a politician's (the politicians' addAliasNow), or says why not. */
export type AddAliasAction = (form: FormData) => Promise<FormResult<AddRefusal>>;

/**
 * Under a politician's aliases, an Add that opens the form to add an address
 * to theirs, such as a personal Gmail, with a note of why, which must be
 * filled. Refused, it says why under its fields, which keep what was typed,
 * or at the page's top that the politician has gone. Added, the form folds
 * back to its Add: `onAdded` hears the address, for the list to show it and
 * draw the eye to it.
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
  // The address last sent, for `onAdded` once the server has it.
  const sent = useRef("");
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
    <ResultForm
      action={(form) => {
        sent.current = String(form.get("address")).trim().toLowerCase();
        return action(form);
      }}
      says={copy.refused}
      atTop={["gone"]}
      done={() => {
        setOpen(false);
        onAdded?.(sent.current);
      }}
      aria-label={copy.add}
      filters
      className={first ? undefined : styles.form}
    >
      <input type="hidden" name="politicianId" value={politicianId} />
      <span className={styles.address}>
        <RefusedTextInput
          name="address"
          type="email"
          required
          aria-label={copy.address}
          placeholder={copy.address}
          wrong={["invalid", "exists", "shared"]}
        />
      </span>
      <span className={styles.note}>
        <RefusedTextInput
          name="note"
          required
          aria-label={copy.note}
          placeholder={copy.notePlaceholder}
          wrong={["note"]}
        />
      </span>
      <SubmitButton variant="primary" size="small" fit>
        {copy.add}
      </SubmitButton>
      <span className={styles.result}>
        <Refusal />
      </span>
    </ResultForm>
  );
}
