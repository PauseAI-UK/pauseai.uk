"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { choiceValue, type OptOutChoice } from "@/lib/supporters/opt-out-choices";
import type { FilterOption } from "@/lib/staff-list-filters";
import { phoneWords } from "@/lib/phone";
import ChannelIcon from "@/components/ui/ChannelIcon";
import MenuSelect from "../ui/MenuSelect";
import styles from "./OptOutForm.module.css";
import { supportersCopy } from "./copy";

const copy = supportersCopy.supporters.detail.permissions;
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
 * Unsubscribe them: a button, with `before` and `beside` either side of it, that opens the form:
 * what they opted out of, one of `options`, sent as `field` with `hidden`'s
 * fields; how they told us, typed, which must be, unless it's known
 * (`howKnown`); then Record opt-out and Cancel. Recording closes it, for the page
 * to show the opt-out, or says, if `record` answers false, they were opted
 * out of it already. `spaced` sets it apart from what's above it.
 * `opened` shows it open to begin with, as the gallery does. A supporter's
 * page has it under their consents (OptOutForm), and a reply under its
 * words (ReplyActions).
 */
export function UnsubscribeForm({
  id,
  hidden,
  field,
  options,
  howKnown = false,
  record,
  before,
  beside,
  spaced = true,
  opened = false,
  end = false,
}: {
  id: string;
  hidden: Record<string, string>;
  field: string;
  options: FilterOption[];
  howKnown?: boolean;
  record: (form: FormData) => Promise<boolean | void> | void;
  before?: ReactNode;
  beside?: ReactNode;
  spaced?: boolean;
  opened?: boolean;
  /** Its buttons at the right, as under a text's reply, whose answer opens at the right. */
  end?: boolean;
}) {
  const [open, setOpen] = useState(opened);
  const [already, setAlready] = useState(false);
  // What's chosen and how they told us, so it can't be recorded till both are.
  const [choice, setChoice] = useState("");
  const [how, setHow] = useState("");
  const space = spaced ? styles.spaced : "";
  if (!open) {
    return (
      <div className={space}>
        <div className={end ? `${styles.buttons} ${styles.end}` : styles.buttons}>
          {before}
          <Button variant="ghost" size="small" fit type="button" onClick={() => setOpen(true)}>
            {words.open}
          </Button>
          {beside}
        </div>
        {already && <p className={`${styles.note} ${styles.already}`}>{words.already}</p>}
      </div>
    );
  }
  return (
    <FormStack
      className={space}
      aria-label={words.open}
      action={async (form) => {
        setAlready((await record(form)) === false);
        setOpen(false);
        setChoice("");
        setHow("");
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <MenuSelect
        id={id}
        name={field}
        label={words.what}
        placeholder={words.choose}
        options={options}
        onChange={setChoice}
      />
      {!howKnown && (
        <Field label={words.how}>
          <TextInput
            name="how"
            required
            placeholder={words.howPlaceholder}
            value={how}
            onChange={(event) => setHow(event.target.value)}
          />
        </Field>
      )}
      <p className={styles.note}>{words.global}</p>
      <div className={styles.buttons}>
        <SubmitButton variant="primary" size="small" fit disabled={!choice || (!howKnown && !how.trim())}>
          {words.record}
        </SubmitButton>
        <Button variant="ghost" size="small" fit type="button" onClick={() => setOpen(false)}>
          {words.cancel}
        </Button>
      </div>
    </FormStack>
  );
}

/**
 * Unsubscribe them, under a supporter's consents: what they opted out of,
 * at which of their addresses or numbers, and how they told us. Nothing for
 * one with no address or number.
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
  if (choices.length === 0) return null;
  return (
    <UnsubscribeForm
      id={`opt-out-${supporterId}`}
      hidden={{ supporterId: String(supporterId) }}
      field="choice"
      options={menuOptions(choices)}
      record={record}
      opened={opened}
    />
  );
}
