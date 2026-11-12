"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import { choiceValue, type OptOutChoice } from "@/lib/opt-out-choices";
import type { FilterOption } from "@/lib/staff-list-filters";
import { phoneWords } from "@/lib/phone";
import ChannelIcon from "./ChannelIcon";
import MenuSelect from "./ui/MenuSelect";
import styles from "./OptOutForm.module.css";

const copy = staffCopy.supporters.detail.permissions;
const words = copy.recordOptOut;

/**
 * The choices as the menu shows them: under each address or number by each
 * way, its icon beside it, so email, texts and calls are apart; each one the
 * topic, or every bulk email.
 */
function menuOptions(choices: OptOutChoice[]): FilterOption[] {
  return choices.map((choice) => ({
    value: choiceValue(choice),
    label: choice.list === "bulk" ? words.bulk : copy.topics[choice.list],
    group: {
      label: `${choice.way === "email" ? choice.address : phoneWords(choice.address)} (${words.ways[choice.way]})`,
      icon: <ChannelIcon channel={choice.way} />,
    },
  }));
}

/**
 * Record an opt-out, a button under a supporter's consents that opens the
 * form: what they opted out of, at which of their addresses or numbers, and
 * how they told us, which must be said; then Record opt-out and Cancel.
 * Recording closes it, for the page to show the opt-out, or says they were
 * opted out of it already. `opened` shows it open to begin with, as the
 * gallery does.
 */
export default function OptOutForm({
  supporterId,
  choices,
  record,
  opened = false,
}: {
  supporterId: number;
  choices: OptOutChoice[];
  record: (form: FormData) => Promise<boolean>;
  opened?: boolean;
}) {
  const [open, setOpen] = useState(opened);
  const [already, setAlready] = useState(false);
  // What's chosen, so it can't be recorded till something is.
  const [choice, setChoice] = useState("");
  if (choices.length === 0) return null;
  if (!open) {
    return (
      <div className={styles.closed}>
        <Button variant="ghost" size="small" fit type="button" onClick={() => setOpen(true)}>
          {words.open}
        </Button>
        {already && <p className={styles.note}>{words.already}</p>}
      </div>
    );
  }
  return (
    <FormStack
      className={styles.form}
      aria-label={words.open}
      action={async (form) => {
        setAlready(!(await record(form)));
        setOpen(false);
        setChoice("");
      }}
    >
      <input type="hidden" name="supporterId" value={supporterId} />
      <MenuSelect
        id={`opt-out-${supporterId}`}
        name="choice"
        label={words.what}
        placeholder={words.choose}
        options={menuOptions(choices)}
        onChange={setChoice}
      />
      <Field label={words.how}>
        <TextInput name="how" required placeholder={words.howPlaceholder} />
      </Field>
      <p className={styles.note}>{words.global}</p>
      <div className={styles.buttons}>
        <SubmitButton variant="primary" size="small" fit disabled={!choice}>
          {words.record}
        </SubmitButton>
        <Button variant="ghost" size="small" fit type="button" onClick={() => setOpen(false)}>
          {words.cancel}
        </Button>
      </div>
    </FormStack>
  );
}
