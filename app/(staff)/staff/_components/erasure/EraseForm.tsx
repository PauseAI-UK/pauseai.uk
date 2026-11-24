"use client";

import Grid, { Card } from "../ui/Grid";
import PageHead from "../ui/PageHead";
import StaffLink from "../ui/StaffLink";
import Strip from "../ui/Strip";
import Actions from "@/components/ui/Actions";
import { useState } from "react";
import { Checkbox } from "@/components/ui/Controls";
import { Field, FieldGroup, Hint } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormResult } from "@/lib/form-result";
import type { SupporterSummary } from "@/lib/supporters/supporters";
import { Refusal, RefusedTextInput, ResultForm } from "../ui/ResultForm";
import styles from "./EraseForm.module.css";
import { supportersCopy } from "../supporters/copy";
import { erasureCopy } from "@/lib/erasure/copy";

/** The Server Action that erases a supporter: refused without the request's reference, or for one already erased. */
export type Erase = (form: FormData) => Promise<FormResult<"blank" | "gone">>;

/**
 * The erase page: whose, and what erasing is for; then a card with a red
 * strip saying it can't be undone, the request's reference for the audit
 * log, a box to tick, and the red button, which does nothing until the box
 * is ticked, or the way back; and beside it, what's erased and what's kept.
 * A reference of nothing but spaces is refused under its field, and a
 * supporter someone else has erased meanwhile at the page's top; the box is
 * then to tick again.
 */
export default function EraseForm({
  supporter,
  action,
}: {
  supporter: Pick<SupporterSummary, "id" | "name">;
  action: Erase;
}) {
  const [sure, setSure] = useState(false);
  const copy = erasureCopy.erase;
  const supporterId = supporter.id;
  return (
    <>
      <PageHead intro={copy.intro}>
        {copy.title}: {supporter.name ?? supportersCopy.supporters.noName}
      </PageHead>
      <Grid>
        <Card span={4}>
          <Strip tone="red">{copy.warning}</Strip>
          <ResultForm stack action={action} says={copy.refused} atTop={["gone"]} className={styles.form}>
            <input type="hidden" name="id" value={supporterId} />
            <FieldGroup>
              <Field label={copy.referenceLabel}>
                <RefusedTextInput name="reference" required wrong={["blank"]} />
              </Field>
              <Hint>{copy.referenceHint}</Hint>
              <Refusal />
            </FieldGroup>
            <Checkbox name="confirm" checked={sure} onChange={setSure}>
              {copy.confirm}
            </Checkbox>
            <Actions>
              <SubmitButton variant="danger" size="small" fit disabled={!sure}>
                {copy.button}
              </SubmitButton>
              <StaffLink href={`/staff/supporters/${supporterId}`}>{copy.cancel}</StaffLink>
            </Actions>
          </ResultForm>
        </Card>
        <Card span={2} look="aside" as="div">
          {[copy.erased, copy.kept].map((part) => (
            <section key={part.title} className={styles.part}>
              <h2>{part.title}</h2>
              <p>{part.text}</p>
            </section>
          ))}
        </Card>
      </Grid>
    </>
  );
}
