"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Ask } from "@/lib/asks/records.server";
import type { FormResult } from "@/lib/form-result";
import type { PreviewMp } from "@/lib/mailings/campaign-letters.server";
import type { MailingChoice } from "@/lib/mailings/fields";
import { CampaignLetterCards, type CampaignLetterValues } from "./CampaignLetterWriter";
import Grid, { Card } from "../ui/Grid";
import { RefusedTextInput, Refusal, ResultForm } from "../ui/ResultForm";
import styles from "./MailingWriter.module.css";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.newCampaign;

/** Why making a campaign is refused: it has no title. */
export type NewCampaignRefusal = "no-title";

/**
 * New campaign: its title and the ask it puts, if any, over its letter,
 * written as a campaign's draft is (CampaignLetterCards). Nothing is kept
 * till Make the campaign, which makes it and the letter's draft together,
 * and opens the draft, to carry on and publish.
 */
export default function NewCampaignWriter({
  start,
  mps,
  asks,
  conditions,
  create,
}: {
  /** The letter it starts with. */
  start: CampaignLetterValues;
  mps: PreviewMp[];
  asks: Ask[];
  conditions: MailingChoice[];
  create: (form: FormData) => Promise<FormResult<NewCampaignRefusal>>;
}) {
  const [values, setValues] = useState(start);
  return (
    <ResultForm action={create} says={copy.refusals}>
      <input type="hidden" name="subject" value={values.subject} />
      <input type="hidden" name="body" value={JSON.stringify(values.body)} />
      <Grid>
        <Card span={6} title={copy.campaign} id="campaign-title">
          <div className={styles.ask}>
            <Field label={copy.title}>
              <RefusedTextInput name="title" wrong={["no-title"]} />
            </Field>
            <Field label={mailingsCopy.mailingPages.ask}>
              <Select name="ask" defaultValue="">
                <option value="">{mailingsCopy.mailingPages.noAsk}</option>
                {asks.map((ask) => (
                  <option key={ask.slug} value={ask.slug}>
                    {ask.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
        <CampaignLetterCards
          values={values}
          change={(changes) => setValues((was) => ({ ...was, ...changes }))}
          restored={0}
          mps={mps}
          asks={asks}
          conditions={conditions}
        />
        <Card span={6} title={copy.makeTitle} id="make-title">
          <div className={styles.send}>
            <SubmitButton variant="primary">{copy.make}</SubmitButton>
          </div>
          <Refusal />
        </Card>
      </Grid>
    </ResultForm>
  );
}
