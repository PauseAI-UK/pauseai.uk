"use client";

import { useOptimistic, useState } from "react";
import Actions from "@/components/ui/Actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, Segmented, TextInput } from "@/components/ui/Controls";
import DatePicker from "@/components/ui/DatePicker";
import { Field, FieldError, FieldSet, Hint } from "@/components/ui/Field";
import { ASK_STATUSES, ASKERS, askSlug, type AskKind, type Asker } from "@/lib/asks/asks";
import type { Ask } from "@/lib/asks/records.server";
import type { FormResult } from "@/lib/form-result";
import { AskPreview } from "./AskLine";
import AskKindIcon from "./AskKindIcon";
import { DeleteTwice } from "../ui/DeleteTwice";
import Grid, { Card } from "../ui/Grid";
import { Refusal, ResultForm } from "../ui/ResultForm";
import Strip from "../ui/Strip";
import styles from "./AskForm.module.css";
import forms from "../ui/StaffForms.module.css";
import { asksCopy } from "@/lib/asks/copy";

const copy = asksCopy.asks;

/** An ask to edit, with whether the code names it, its kind can change, and it can be deleted. */
export type EditableAsk = Ask & { named: boolean; kindFixed: boolean; deletable: boolean };

/**
 * What the form's Save and Delete do (asks/actions.ts): each goes to another
 * page, or back to this one saying why not (`notice`), so neither answers a
 * refusal.
 */
type FormAction = (form: FormData) => Promise<FormResult<never>>;

/**
 * Adding an ask, or editing `ask`, beside it as it will show on a
 * politician's page, changing as it's typed. The kind comes first, and the
 * rest is asked in its words: which letter or event, an example of how to
 * name it, when, and where to find it; then who asks. Under it, Save,
 * which goes back to `back`, and beside it Delete, pressed twice, only
 * while nothing refers to the ask and the code doesn't name it. Its slug is
 * said, not changed; its kind is fixed once politicians have answered it.
 * `notice` says how the last save or delete went. A save that fails says so
 * at the form's foot, over Save, with what was typed still there.
 */
export default function AskForm({
  ask,
  back,
  notice,
  save,
  remove,
}: {
  ask: EditableAsk | null;
  back: string;
  notice: string;
  save: FormAction;
  remove: FormAction;
}) {
  const [kind, setKind] = useState(ask?.kind ?? "letter");
  const [title, setTitle] = useState(ask?.title ?? "");
  const [date, setDate] = useState(ask?.date ?? "");
  const [url, setUrl] = useState(ask?.url ?? "");
  const [askedBy, setAskedBy] = useState<Asker[]>(ask?.askedBy ?? ["pauseai"]);
  // Save, pending while it saves: it's outside the form, so SubmitButton can't tell.
  const [saving, setSaving] = useOptimistic(false);
  // How many times it's been sent. Once a form's action ends, React puts its tick boxes back as they were first
  // drawn, whatever they're held as, so who asks is drawn afresh after each send, as it's ticked now.
  const [sends, setSends] = useState(0);
  const words = copy.byKind[kind];
  // A link that isn't a whole one, which the server would refuse (askFrom).
  const badLink = Boolean(url) && !url.startsWith("https://");
  return (
    <>
      {copy.notices[notice] && (
        <Strip tone={notice === "added" || notice === "saved" ? "green" : "amber"} announce>
          {copy.notices[notice]}
        </Strip>
      )}
      <div className={styles.form}>
        <Grid>
          <Card span={3}>
            <ResultForm
              stack
              id="ask-form"
              action={(form) => {
                setSaving(true);
                return save(form).finally(() => setSends((n) => n + 1));
              }}
              says={{}}
            >
              <input type="hidden" name="back" value={back} />
              {ask && <input type="hidden" name="slug" value={ask.slug} />}
              <Field label={copy.fields.kind}>
                <Segmented
                  label={copy.fields.kind}
                  options={Object.keys(ASK_STATUSES).map((one) => ({
                    value: one as AskKind,
                    label: copy.kinds[one],
                    icon: <AskKindIcon kind={one as AskKind} />,
                  }))}
                  value={kind}
                  onChange={setKind}
                  disabled={ask?.kindFixed}
                />
              </Field>
              <input type="hidden" name="kind" value={kind} />
              {ask?.kindFixed && <Hint>{copy.kindFixed}</Hint>}
              {/* The title, and under it the slug it gives a new ask, or an ask's own, which doesn't change. */}
              <div className={styles.titled}>
                <Field label={words.title}>
                  <TextInput
                    name="title"
                    required
                    value={title}
                    placeholder={words.titleExample}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                {(ask || title.trim()) && (
                  <p className={styles.slug}>
                    <span>{copy.slugLabel}</span> <code>{ask ? ask.slug : askSlug(title, date || null)}</code>
                  </p>
                )}
              </div>
              <Field label={words.date} className={forms.short}>
                <DatePicker name="date" value={date} onChange={setDate} clearable />
              </Field>
              <Field label={words.url}>
                <TextInput
                  name="url"
                  value={url}
                  placeholder="https://"
                  onChange={(event) => setUrl(event.target.value)}
                  aria-invalid={badLink}
                  aria-describedby={badLink ? "ask-link-error" : undefined}
                />
              </Field>
              {badLink && <FieldError id="ask-link-error">{copy.badLink}</FieldError>}
              <FieldSet key={sends} label={copy.fields.askedBy}>
                {ASKERS.map((asker) => (
                  <Checkbox
                    key={asker}
                    name="askedBy"
                    value={asker}
                    checked={askedBy.includes(asker)}
                    onChange={(on) => setAskedBy(on ? [...askedBy, asker] : askedBy.filter((one) => one !== asker))}
                  >
                    {copy.askedBy[asker]}
                  </Checkbox>
                ))}
              </FieldSet>
              <Refusal />
            </ResultForm>
            <Actions>
              <Button
                type="submit"
                form="ask-form"
                variant="primary"
                fit
                disabled={!title.trim() || !date || badLink}
                pending={saving}
              >
                {copy.save}
              </Button>
              {ask?.deletable && (
                <DeleteTwice name="slug" value={ask.slug} label={copy.delete} action={remove} says={{}} />
              )}
            </Actions>
            {ask && !ask.deletable && <Hint>{ask.named ? copy.named : copy.notDeletable}</Hint>}
          </Card>
          <Card span={3} look="aside" title={copy.previewTitle} id="ask-preview">
            <AskPreview
              ask={{
                slug: ask?.slug ?? "",
                kind,
                title: title || words.titleExample,
                date: date || null,
                url: url || null,
                askedBy,
              }}
            />
          </Card>
        </Grid>
      </div>
    </>
  );
}
