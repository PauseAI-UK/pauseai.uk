"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BubbleBox } from "@/components/ui/Bubble";
import { Button } from "@/components/ui/Button";
import { bubbleTrigger } from "@/components/ui/bubble-trigger";
import { TextInput } from "@/components/ui/Controls";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorText } from "@/components/ui/Text";
import { surnameOf } from "@/lib/politicians/salutation";
import type { EmailSource, PoliticianAliases } from "@/lib/politicians/aliases.server";
import type { EditResult } from "@/lib/politicians/edits.server";
import { staffDate } from "@/lib/staff-time";
import AddAliasForm, { type AddAliasAction } from "./AddAliasForm";
import styles from "./PoliticianWriting.module.css";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician.editDetails;
const words = politiciansCopy.politician.aliases;

/** Saves a salutation or an email, saying how it went. */
export type EditAction = (form: FormData) => Promise<EditResult | undefined> | EditResult | undefined | void;

type Politician = {
  id: number;
  name: string;
  salutation: string;
  salutationToCheck: boolean;
  email: string | null;
  house?: string;
};

/** Closes the bubble a form is in. */
const closeBubble = (inside: HTMLElement | null) => inside?.closest<HTMLElement>("[popover]")?.hidePopover();

/** Values a field likely takes, each a button that puts it in the field, with a line saying why they're offered. */
type Choices = { hint: string; values: string[] };

/**
 * A field, sent with `hidden`; any `choices` for it; then a field for the
 * note of why it changed, which must be filled, and Save; and, once the
 * server has it, that it's saved, calling `onSaved` or else closing the
 * bubble, or why not.
 */
function SaveField({
  label,
  name,
  type = "text",
  value,
  hidden,
  action,
  choices,
  onSaved,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  hidden: Record<string, string | number>;
  action: EditAction;
  choices?: Choices;
  onSaved?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<EditResult | undefined>();
  const send = async (data: FormData) => {
    const answer = (await action(data)) ?? undefined;
    setResult(answer);
    if (answer?.saved) {
      if (onSaved) onSaved();
      else closeBubble(form.current);
    }
  };
  // A choice fills the field, and leads on to the note.
  const choose = (choice: string) => {
    const fields = form.current!.elements;
    (fields.namedItem(name) as HTMLInputElement).value = choice;
    (fields.namedItem("note") as HTMLInputElement).focus();
  };
  return (
    <form ref={form} action={send} aria-label={label} className={styles.form}>
      {Object.entries(hidden).map(([key, v]) => (
        <input key={key} type="hidden" name={key} value={v} />
      ))}
      <span className={styles.wholeField}>
        <TextInput name={name} type={type} required={name === "salutation"} defaultValue={value} aria-label={label} />
      </span>
      {choices && (
        <span className={styles.wholeField}>
          <p className={styles.hint}>{choices.hint}</p>
          <span className={styles.choices}>
            {choices.values.map((choice) => (
              <Button key={choice} type="button" variant="ghost" size="small" fit onClick={() => choose(choice)}>
                {choice}
              </Button>
            ))}
          </span>
        </span>
      )}
      <span className={styles.field}>
        <TextInput name="note" required placeholder={copy.notePlaceholder} aria-label={copy.note} />
      </span>
      <SubmitButton variant="primary" size="small" fit>
        {copy.save}
      </SubmitButton>
      <span role="status" className={styles.status}>
        {result && !result.saved && <ErrorText>{copy.refused[result.why]}</ErrorText>}
      </span>
    </form>
  );
}

/**
 * A politician's salutation, as a letter to them starts ("Dear Ms
 * Placeholder,"), for the band at the top of their page; given `action`, a
 * Edit that opens a bubble with the field to change it, and why. For one
 * made from their name, as their gender isn't known, the bubble says so,
 * and offers the two it most likely is, Ms and Mr with their surname, each
 * a press that puts it in the field.
 */
export function SalutationBubble({ politician, action }: { politician: Politician; action?: EditAction }) {
  const id = `salutation-${politician.id}`;
  return (
    <span className={styles.value}>
      <span>{copy.dear(politician.salutation)}</span>
      {action && (
        <>
          <button type="button" className={styles.trigger} {...bubbleTrigger(id)}>
            {copy.edit}
          </button>
          <BubbleBox id={id} className={styles.bubble}>
            <h3 className={styles.heading}>{copy.salutation}</h3>
            <SaveField
              label={copy.salutation}
              name="salutation"
              value={politician.salutation}
              hidden={{ politicianId: politician.id }}
              action={action}
              choices={
                politician.salutationToCheck
                  ? { hint: copy.fromName, values: ["Ms", "Mr"].map((t) => `${t} ${surnameOf(politician.name)}`) }
                  : undefined
              }
            />
          </BubbleBox>
        </>
      )}
    </span>
  );
}

/**
 * Where their email came from, in words: why, then who set it and when, as an
 * ask's answer says; their body's list, by their `house`; or Airtable.
 */
function sourceLine(source: NonNullable<EmailSource>, house?: string): string {
  if (source.by === "staff") {
    const setBy = politiciansCopy.politician.setBy(source.staff, staffDate(source.at));
    return source.note ? `${source.note} · ${setBy}` : setBy;
  }
  return source.by === "body" ? words.sources.parliament(house) : copy.fromAirtable;
}

/** The changes a politician's addresses can take: adding one, and removing one staff added or guessed. */
export type AliasActions = { add: AddAliasAction; remove: (form: FormData) => void | Promise<void> };

/** An address that links their emails, with where it came from, and a Remove for one staff can take off. */
type Line = { key: string; address: string; from: ReactNode; removable?: boolean };

/**
 * A politician's email, for the band at the top of their page, and after
 * it a button opening a bubble of every other address that says an email
 * is theirs, with where each came from, a Remove by each staff added or
 * guessed was their office's, and the form to add one, once they have an
 * email. Their email heads it, with where it came from, and, given
 * `setEmail`, an edit that opens the field to change it, with a note of
 * why; open at once while they have none. `open` opens the bubble at once,
 * as a link to it does.
 */
export function AddressesBubble({
  politician,
  aliases,
  actions,
  setEmail,
  open = false,
}: {
  politician: Politician;
  aliases: PoliticianAliases;
  actions: AliasActions;
  setEmail?: EditAction;
  open?: boolean;
}) {
  const id = `addresses-${politician.id}`;
  const bubble = useRef<HTMLDivElement>(null);
  // The address just added, which pulses once at the foot of the list.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // Whether their email's field is open, from its edit; while they have none, it always is.
  const [editing, setEditing] = useState(false);
  // A fresh start for the add form, and what it said, after a remove or a close; a close folds the email's field too.
  const [round, setRound] = useState(0);
  const freshStart = () => {
    setRound((r) => r + 1);
    setJustAdded(null);
  };
  useEffect(() => {
    const box = bubble.current!;
    if (open) box.showPopover();
    const toggled = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") {
        freshStart();
        setEditing(false);
      }
    };
    box.addEventListener("toggle", toggled);
    return () => box.removeEventListener("toggle", toggled);
  }, [open]);
  const of = (key: string, addresses: string[], from: string): Line[] =>
    addresses.map((address) => ({ key: `${key} ${address}`, address, from }));
  const lines: Line[] = [
    ...of("past", aliases.past, words.sources.past),
    ...of("parliament", aliases.parliament, words.sources.parliament(politician.house)),
    ...aliases.office.map((address) => ({
      key: `office ${address}`,
      address,
      from: words.sources.office,
      removable: true,
    })),
    ...of(
      "domain",
      aliases.domains.map((domain) => `@${domain}`),
      words.sources.domain,
    ),
    ...of("form", aliases.forms, words.sources.form),
    // Those staff added last, oldest first, so a new one appears at the foot, by the field it came from.
    ...[...aliases.added]
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .map(({ address, addedBy, at, note }) => ({
        key: `added ${address}`,
        address,
        // Why, then who and when, as their main address says it.
        from: note ? `${note} · ${words.addedBy(addedBy, staffDate(at))}` : words.addedBy(addedBy, staffDate(at)),
        removable: true,
      })),
  ];
  return (
    <span className={styles.value}>
      {politician.email ? (
        <a href={`mailto:${politician.email}`}>{politician.email}</a>
      ) : (
        politiciansCopy.politicians.noEmail
      )}
      <button type="button" className={styles.trigger} {...bubbleTrigger(id)}>
        {/* With no other address, there's nothing more: only their email to edit. */}
        {politician.email ? (lines.length ? words.more(lines.length) : copy.edit) : copy.add}
      </button>
      <BubbleBox id={id} ref={bubble} className={styles.bubble}>
        {(setEmail || politician.email) && (
          <div className={styles.part}>
            <h3 className={styles.heading}>{copy.mainEmail}</h3>
            <p className={styles.intro}>{copy.mainIntro}</p>
            {setEmail && (editing || !politician.email) ? (
              <SaveField
                label={copy.email}
                name="email"
                type="email"
                value={politician.email ?? ""}
                hidden={{ politicianId: politician.id, salutation: politician.salutation }}
                action={setEmail}
                // Saved, the bubble stays open, the field folded, to show the new address and where it came from.
                onSaved={() => setEditing(false)}
              />
            ) : (
              <div className={styles.main}>
                <span className={styles.address}>
                  {politician.email}
                  {aliases.emailSource && (
                    <span className={styles.from}>{sourceLine(aliases.emailSource, politician.house)}</span>
                  )}
                </span>
                {setEmail && (
                  <Button type="button" variant="ghost" size="small" fit onClick={() => setEditing(true)}>
                    {politiciansCopy.politician.edit}
                  </Button>
                )}
              </div>
            )}
            {!politician.email && politician.house === "lords" && <p className={styles.hint}>{copy.emailHint}</p>}
          </div>
        )}
        {politician.email && (
          <div className={styles.part}>
            <h3 className={styles.heading}>{words.title}</h3>
            <p className={styles.intro}>{words.intro}</p>
            <ul className={styles.addresses}>
              {lines.map((line) => (
                <li key={line.key} data-pulse={line.address === justAdded || undefined}>
                  <span className={styles.address}>
                    {line.address}
                    <span className={styles.from}>{line.from}</span>
                  </span>
                  {line.removable && (
                    <FilterForm
                      action={async (form) => {
                        freshStart();
                        await actions.remove(form);
                      }}
                      aria-label={`${words.remove}: ${line.address}`}
                    >
                      <input type="hidden" name="politicianId" value={politician.id} />
                      <input type="hidden" name="address" value={line.address} />
                      <SubmitButton variant="ghost" size="small" fit>
                        {words.remove}
                      </SubmitButton>
                    </FilterForm>
                  )}
                </li>
              ))}
            </ul>
            <AddAliasForm
              key={round}
              politicianId={politician.id}
              action={actions.add}
              onAdded={setJustAdded}
              first={lines.length === 0}
            />
          </div>
        )}
      </BubbleBox>
    </span>
  );
}
