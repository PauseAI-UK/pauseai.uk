"use client";

import Grid, { Card } from "./ui/Grid";
import PageHead from "./ui/PageHead";
import StaffLink from "./ui/StaffLink";
import Strip from "./ui/Strip";
import Actions from "@/components/ui/Actions";
import { useState } from "react";
import { Checkbox, TextInput } from "@/components/ui/Controls";
import { Field, FieldGroup, Hint } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SupporterSummary } from "@/lib/supporters";
import styles from "./EraseForm.module.css";

/**
 * The erase page: whose, and what erasing is for; then a card with a red
 * strip saying it can't be undone, the request's reference for the audit
 * log, a box to tick, and the red button, which does nothing until the box
 * is ticked, or the way back; and beside it, what's erased and what's kept.
 */
export default function EraseForm({
  supporter,
  action,
}: {
  supporter: Pick<SupporterSummary, "id" | "name">;
  action: (form: FormData) => void | Promise<void>;
}) {
  const [sure, setSure] = useState(false);
  const copy = staffCopy.erase;
  const supporterId = supporter.id;
  return (
    <>
      <PageHead intro={copy.intro}>
        {copy.title}: {supporter.name ?? staffCopy.supporters.noName}
      </PageHead>
      <Grid>
        <Card span={4}>
          <Strip tone="red">{copy.warning}</Strip>
          <FormStack action={action} className={styles.form}>
            <input type="hidden" name="id" value={supporterId} />
            <FieldGroup>
              <Field label={copy.referenceLabel}>
                <TextInput name="reference" required />
              </Field>
              <Hint>{copy.referenceHint}</Hint>
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
          </FormStack>
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
