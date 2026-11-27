"use client";

import type { JSONContent } from "@tiptap/react";
import { useId, useState } from "react";
import { TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { CAMPAIGN_FIELDS, draftLetter, unpublishable, type UnpublishableReason } from "@/lib/email-your-mp";
import type { Ask } from "@/lib/asks/records.server";
import type { FormResult } from "@/lib/form-result";
import type { PreviewMp } from "@/lib/mailings/campaign-letters.server";
import { type MailingDoc } from "@/lib/mailings/doc";
import { answerLabels, type MailingChoice } from "@/lib/mailings/fields";
import { DraftTitle, ProblemList, ScheduleButton, useDraftWriter, type SaveRefusal } from "./DraftWriter";
import { DeleteDraft } from "./MailingButtons";
import MailEmail from "./MailEmail";
import MailingEditor from "./MailingEditor";
import { MailingLetter } from "./MailingLetter";
import { useRecipientChoice } from "./RecipientChoice";
import Grid, { Card } from "../ui/Grid";
import Strip from "../ui/Strip";
import styles from "./MailingWriter.module.css";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.campaignLetter;

/** Why publishing is refused: the draft's moved on or gone, or it has no subject or letter. */
export type PublishRefusal = SaveRefusal | UnpublishableReason;

/** The Server Actions writing a campaign's letter takes, which the page hands in. */
export type CampaignLetterActions = {
  save: (id: number, version: number, changes: unknown) => Promise<FormResult<SaveRefusal, { version: number }>>;
  publish: (id: number, version: number) => Promise<FormResult<PublishRefusal>>;
  discard: (form: FormData) => Promise<FormResult<never>>;
};

type Changes = { subject: string; body: MailingDoc };

/**
 * A campaign's draft letter: its subject and its letter, saved as they're
 * typed, in the mailings' editor, with the MP's fields and the sender's
 * name, and parts only for MPs with an answer to an ask. Beside it, the
 * letter as an MP's constituent starts from it, an MP chosen as a
 * mailing's preview chooses a recipient, signed with a made-up sender, as
 * the site can't know who'll write. Publish makes it what supporters start
 * from; Delete draft throws it away.
 */
export default function CampaignLetterWriter({
  title,
  draft,
  mps,
  asks,
  conditions,
  actions,
}: {
  /** The campaign's. */
  title: string;
  draft: { id: number; version: number; subject: string; body: MailingDoc };
  mps: PreviewMp[];
  asks: Ask[];
  conditions: MailingChoice[];
  actions: CampaignLetterActions;
}) {
  const letterLabel = useId();
  // Why the last Publish was refused, but for a save since, which the page says as a save refused does.
  const [refusal, setRefusal] = useState<Exclude<PublishRefusal, "conflict">>();
  const { values, change, saveNow, saveState, version, stale, conflicted, restored } = useDraftWriter<Changes>({
    kind: "campaign-letter",
    id: draft.id,
    version: draft.version,
    initial: { subject: draft.subject, body: draft.body },
    fresh: {},
    actions,
  });
  const fields = CAMPAIGN_FIELDS.map((id) => ({ id, label: mailingsCopy.campaigns.fields[id] }));
  const { recipient: mp, choice } = useRecipientChoice({
    recipients: mps,
    body: values.body,
    labels: answerLabels(asks),
  });
  // What stops it being published, as the server checks too.
  const problems = [unpublishable(values)].filter((one) => one !== undefined);

  return (
    <>
      <DraftTitle title={copy.title(title)} saveState={saveState} />
      {saveState === "conflict" && (
        <Strip tone="red" announce>
          {mailingsCopy.mailingPages.saveStates.conflict}
        </Strip>
      )}
      <Grid>
        <Card span={3} title={copy.write} id="write-title">
          <Field label={mailingsCopy.mailingPages.subject}>
            <TextInput value={values.subject} onChange={(event) => change({ subject: event.target.value })} />
          </Field>
          <div className={styles.letter}>
            <p id={letterLabel} className={styles.label}>
              {mailingsCopy.mailingPages.letter}
            </p>
            {/* Made anew with what a reload kept, as it reads its words once. */}
            <MailingEditor
              key={restored}
              initial={values.body as JSONContent}
              onChange={(doc) => change({ body: doc as MailingDoc })}
              fields={fields}
              conditions={conditions}
              recipients={mps.length}
              labelledBy={letterLabel}
            />
          </div>
        </Card>
        <Card span={3} look="aside" title={copy.preview} id="preview-title">
          {mps.length === 0 ? (
            <p>{copy.noMps}</p>
          ) : (
            <>
              {choice}
              {mp ? (
                <MailEmail from={<Muted>{copy.exampleSender}</Muted>} to={mp.name} subject={values.subject}>
                  <MailingLetter
                    doc={draftLetter(
                      values.body,
                      {
                        salutation: mp.values.salutation,
                        mpName: mp.name,
                        constituency: mp.values.constituency,
                        senderName: copy.exampleSender,
                        statuses: Object.fromEntries(mp.meets.map((meets) => meets.split(":"))),
                      },
                      copy.exampleAddress,
                    )}
                  />
                </MailEmail>
              ) : (
                <p className={styles.noEmail}>{mailingsCopy.mailingPages.noOneMix}</p>
              )}
              <Muted>{copy.exampleNote}</Muted>
            </>
          )}
        </Card>
        <Card span={6} title={copy.publishTitle} id="publish-title">
          <div className={styles.send}>
            <ScheduleButton
              label={copy.publish}
              disabled={problems.length > 0 || saveState === "conflict"}
              saveNow={saveNow}
              schedule={async () => {
                setRefusal(undefined);
                const result = await actions.publish(draft.id, version.current);
                if (result.ok) return result;
                // One changed elsewhere since its last save says so, as a save refused does.
                if (result.reason === "conflict") conflicted();
                else setRefusal(result.reason);
                return result;
              }}
              stale={stale}
            />
            <DeleteDraft id={draft.id} action={actions.discard} says={{}} />
          </div>
          <ProblemList problems={[...problems, ...(refusal ? [refusal] : [])].map((one) => copy.refusals[one])} />
        </Card>
      </Grid>
    </>
  );
}
