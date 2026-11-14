"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BubbleBox } from "@/components/ui/Bubble";
import { bubbleTrigger } from "@/components/ui/bubble-trigger";
import { TextInput } from "@/components/ui/Controls";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ErrorText } from "@/components/ui/Text";
import { surnameOf } from "@/lib/politicians/salutation";
import type { PoliticianAliases } from "@/lib/politicians/aliases";
import type { EditResult } from "@/lib/politicians/edits";
import { staffDate } from "@/lib/staff-time";
import AddAliasForm, { type AddAliasAction } from "./AddAliasForm";
import styles from "./PoliticianWriting.module.css";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician.editDetails;
const words = politiciansCopy.politician.aliases;

/** Saves a salutation or a Lord's email, saying how it went. */
export type EditAction = (form: FormData) => Promise<EditResult | undefined> | EditResult | undefined | void;

type Politician = { id: number; name: string; salutation: string; salutationToCheck: boolean; email: string | null };

/** Closes the bubble a form is in. */
const closeBubble = (inside: HTMLElement | null) => inside?.closest<HTMLElement>("[popover]")?.hidePopover();

/**
 * A field and its Save, sent with `hidden`; and, once the server has it,
 * that it's saved, closing the bubble, or why not.
 */
function SaveField({
  label,
  name,
  type = "text",
  value,
  hidden,
  action,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  hidden: Record<string, string | number>;
  action: EditAction;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<EditResult | undefined>();
  const send = async (data: FormData) => {
    const answer = (await action(data)) ?? undefined;
    setResult(answer);
    if (answer?.saved) closeBubble(form.current);
  };
  return (
    <form ref={form} action={send} aria-label={label} className={styles.form}>
      {Object.entries(hidden).map(([key, v]) => (
        <input key={key} type="hidden" name={key} value={v} />
      ))}
      <span className={styles.field}>
        <TextInput name={name} type={type} required={name === "salutation"} defaultValue={value} aria-label={label} />
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
 * Edit that opens a bubble with the field to change it. For one made from
 * their name, as their gender isn't known, the bubble says so, and offers
 * the two it most likely is, Ms and Mr with their surname, a press each.
 */
export function SalutationBubble({ politician, action }: { politician: Politician; action?: EditAction }) {
  const id = `salutation-${politician.id}`;
  const hidden = { politicianId: politician.id };
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
              hidden={hidden}
              action={action}
            />
            {politician.salutationToCheck && <p className={styles.hint}>{copy.fromName}</p>}
            {politician.salutationToCheck && (
              <span className={styles.choices}>
                {["Ms", "Mr"].map((title) => (
                  <SaveChoice
                    key={title}
                    value={`${title} ${surnameOf(politician.name)}`}
                    hidden={hidden}
                    action={action}
                  />
                ))}
              </span>
            )}
          </BubbleBox>
        </>
      )}
    </span>
  );
}

/** A button that saves `value` as the salutation, closing the bubble. */
function SaveChoice({
  value,
  hidden,
  action,
}: {
  value: string;
  hidden: Record<string, string | number>;
  action: EditAction;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={async (data) => {
        if ((await action(data))?.saved) closeBubble(form.current);
      }}
    >
      {Object.entries(hidden).map(([key, v]) => (
        <input key={key} type="hidden" name={key} value={v} />
      ))}
      <input type="hidden" name="salutation" value={value} />
      <SubmitButton variant="ghost" size="small" fit>
        {value}
      </SubmitButton>
    </form>
  );
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
 * email. A Lord's email can be set there too (`setEmail`), as most Lords
 * list none of their own. `open` opens it at once, as a link to it does.
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
  // A fresh start for the add form, and what it said, after a remove or a close.
  const [round, setRound] = useState(0);
  const freshStart = () => {
    setRound((r) => r + 1);
    setJustAdded(null);
  };
  useEffect(() => {
    const box = bubble.current!;
    if (open) box.showPopover();
    const toggled = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") freshStart();
    };
    box.addEventListener("toggle", toggled);
    return () => box.removeEventListener("toggle", toggled);
  }, [open]);
  const of = (key: string, addresses: string[], from: string): Line[] =>
    addresses.map((address) => ({ key: `${key} ${address}`, address, from }));
  const lines: Line[] = [
    ...of("past", aliases.past, words.sources.past),
    ...of("parliament", aliases.parliament, words.sources.parliament),
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
      .map(({ address, addedBy, at }) => ({
        key: `added ${address}`,
        address,
        from: words.addedBy(addedBy, staffDate(at)),
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
        {politician.email ? words.more(lines.length) : copy.add}
      </button>
      <BubbleBox id={id} ref={bubble} className={styles.bubble}>
        {setEmail && (
          <div className={styles.part}>
            <h3 className={styles.heading}>{copy.mainEmail}</h3>
            <SaveField
              label={copy.email}
              name="email"
              type="email"
              value={politician.email ?? ""}
              hidden={{ politicianId: politician.id, salutation: politician.salutation }}
              action={setEmail}
            />
            {!politician.email && <p className={styles.hint}>{copy.emailHint}</p>}
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
            <AddAliasForm key={round} politicianId={politician.id} action={actions.add} onAdded={setJustAdded} />
          </div>
        )}
      </BubbleBox>
    </span>
  );
}
