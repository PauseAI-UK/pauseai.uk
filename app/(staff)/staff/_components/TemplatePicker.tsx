"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Radio, TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { MessageTemplate } from "@/lib/server/message-drafts";
import { staffDate } from "@/lib/staff-time";
import { FIELD_WORDS, firstWords } from "@/lib/supporter-messages";
import letter from "./MailingLetter.module.css";
import styles from "./Messages.module.css";

const copy = staffCopy.messagePages;

/** How many templates show until Show all. */
const SHOWN_AT_FIRST = 5;

/** Who made a template, when it was approved and when it was last used, in words. */
export function templateLine(template: MessageTemplate): string {
  return copy.templateBy(
    template.createdBy ?? copy.templateMadeIn,
    staffDate(template.approvedAt!),
    template.lastUsedAt
      ? copy.templateUsed(staffDate(template.lastUsedAt), template.lastUsedTo)
      : copy.templateNeverUsed,
  );
}

/** A template's first words, each `{field}` in them a lozenge, as the editor shows it. */
function WithFields({ words }: { words: string }) {
  return words.split(/(\{[^}]+\})/).map((part, i) =>
    part.startsWith("{") && part.endsWith("}") ? (
      <span key={i} className={letter.field}>
        {part.slice(1, -1)}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * The WhatsApp approved templates to choose from, as radio rows, as they're
 * given, most recently used first: five, with a search and Show all, as
 * there may come to be dozens. The one `chosen` is checked, and stays in
 * the list as another is chosen, whichever five show.
 */
export default function TemplatePicker({
  templates,
  chosen,
  onChoose,
}: {
  templates: MessageTemplate[];
  chosen?: number;
  onChoose: (template: MessageTemplate) => void;
}) {
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const words = search.trim().toLowerCase();
  const found = templates.filter(
    (one) => !words || `${one.name} ${firstWords(one.body, FIELD_WORDS)}`.toLowerCase().includes(words),
  );
  const shown = all || words ? found : found.filter((one, i) => i < SHOWN_AT_FIRST || one.id === chosen);
  // None at all: nothing to search, only where to write some.
  if (templates.length === 0) {
    return (
      <p className={styles.templatesNone}>
        <Muted>{copy.noTemplatesYet}</Muted>
      </p>
    );
  }
  return (
    <fieldset className={styles.picker} aria-label={copy.templatesLabel}>
      <Field label={copy.searchTemplates}>
        <TextInput
          value={search}
          placeholder={copy.searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <div className={styles.templates}>
        {shown.map((one) => (
          <label key={one.id} className={styles.template}>
            <Radio name="template" value={one.id} checked={one.id === chosen} onChange={() => onChoose(one)} />
            <span className={styles.templateText}>
              <strong>{one.name}</strong>
              <span>
                <WithFields words={firstWords(one.body, FIELD_WORDS)} />
              </span>
              <Muted>{templateLine(one)}</Muted>
            </span>
          </label>
        ))}
        {found.length === 0 && (
          <p className={styles.templatesNone}>
            <Muted>{copy.noTemplates}</Muted>
          </p>
        )}
        {found.length > shown.length && (
          <div className={styles.templatesFoot}>
            <Button variant="ghost" size="small" fit type="button" onClick={() => setAll(true)}>
              {copy.showAll(found.length)}
            </Button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
