"use client";

import { useId, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { conditionsIn, NOT_CONDITION, type MailingDoc, type MailingRecipientValues } from "@/lib/mailings/doc";
import NotIcon from "../ui/NotIcon";
import { partButton, partButtonWords } from "./PartBox";
import styles from "./MailingWriter.module.css";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;

/** Someone a preview can show a letter for: their values, and how they're named in the choice. */
export type Choosable = MailingRecipientValues & { id: number; name: string; constituency: string | null };

/**
 * Whose letter a preview shows, of `recipients`, and the way to choose:
 * a button for each condition `body`'s parts use, by `labels`, pressed
 * for those who meet it, unpressed for those who don't, each press
 * choosing the first recipient with the answers pressed; then the choice
 * of every recipient, which sets the buttons to theirs. With no one with
 * the answers pressed, `recipient` is none, as there's no one to fill it
 * in for. `chosen` is called when the choice changes.
 */
export function useRecipientChoice<Recipient extends Choosable>({
  recipients,
  body,
  labels,
  chosen: onChosen,
}: {
  recipients: Recipient[];
  body: MailingDoc;
  labels: Record<string, string>;
  chosen?: () => void;
}): { recipient: Recipient | undefined; choice: ReactNode } {
  const findLabel = useId();
  const [chosen, setChosen] = useState(recipients[0]?.id);
  // The answers pressed, since someone was last chosen; else theirs.
  const [wanted, setWanted] = useState<Record<string, boolean>>({});
  const shown = recipients.find((r) => r.id === chosen) ?? recipients[0];
  if (!shown) return { recipient: undefined, choice: null };
  const used = [
    ...new Set(conditionsIn(body).map((c) => (c.startsWith(NOT_CONDITION) ? c.slice(NOT_CONDITION.length) : c))),
  ];
  const meets = Object.fromEntries(used.map((c) => [c, wanted[c] ?? shown.meets.includes(c)]));
  const fits = (r: Recipient, answers: Record<string, boolean>) =>
    used.every((c) => r.meets.includes(c) === answers[c]);
  const recipient = fits(shown, meets) ? shown : undefined;
  const toggle = (condition: string) => {
    const answers = { ...meets, [condition]: !meets[condition] };
    setWanted(answers);
    const match = recipients.find((r) => fits(r, answers));
    if (match) setChosen(match.id);
    onChosen?.();
  };
  const choice = (
    <>
      {used.length > 0 && (
        <div className={styles.find}>
          <p id={findLabel} className={styles.label}>
            {copy.findRecipient}
          </p>
          <ul className={styles.toggles} aria-labelledby={findLabel}>
            {used.map((condition) => (
              <li key={condition}>
                <button
                  type="button"
                  aria-pressed={meets[condition]}
                  className={partButton(!meets[condition])}
                  onClick={() => toggle(condition)}
                >
                  {!meets[condition] && <NotIcon />}
                  <span className={partButtonWords}>{labels[condition] ?? condition}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field label={copy.chooseRecipient} className={styles.whoShown}>
        <Select
          value={recipient?.id ?? ""}
          onChange={(event) => {
            setChosen(Number(event.target.value));
            setWanted({});
            onChosen?.();
          }}
        >
          {!recipient && <option value="" disabled />}
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.constituency ? `${r.name} · ${r.constituency}` : r.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
  return { recipient, choice };
}
