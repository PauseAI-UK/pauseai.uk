"use client";

// ResultForm's examples that keep state or log what's pressed (ResultForm.gallery.tsx).
import Actions from "@/components/ui/Actions";
import { Button } from "@/components/ui/Button";
import { Field, FieldGroup } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { refused } from "@/lib/form-result";
import Grid, { Card } from "./Grid";
import { Refusal, RefusalPlace, RefusedTextArea, RefusedTextInput, ResultForm } from "./ResultForm";

const SAYS = {
  blank: "Give the filter a name.",
  gone: "Someone has deleted this filter.",
};

/**
 * A form with a field, refused from the start for what's typed in it, and
 * again whenever it's sent: a text area, or with `box`, a text box.
 */
export function TypedWrongExample({ box = false }: { box?: boolean }) {
  return (
    <Grid>
      <Card span={3}>
        <ResultForm stack action={() => Promise.resolve(refused("blank"))} says={SAYS} starts="blank">
          <FieldGroup>
            <Field label="Name">
              {box ? (
                <RefusedTextInput name="name" defaultValue="   " wrong={["blank"]} />
              ) : (
                <RefusedTextArea name="name" defaultValue="   " rows={2} wrong={["blank"]} />
              )}
            </Field>
            <Refusal />
          </FieldGroup>
          <Actions>
            <SubmitButton variant="primary" size="small" fit>
              Save
            </SubmitButton>
            <Button variant="ghost" size="small" fit type="button">
              Cancel
            </Button>
          </Actions>
        </ResultForm>
      </Card>
    </Grid>
  );
}

/** A form that's only a button, failed from the start, and again whenever it's sent, as its action throws. */
export function FailedExample() {
  return (
    <Grid>
      <Card span={3}>
        <ResultForm<never>
          action={() => Promise.reject(new Error("An example of a save that failed"))}
          says={{}}
          starts="failed"
        >
          <SubmitButton variant="ghost" size="small" fit>
            Update for all
          </SubmitButton>
          <Refusal />
        </ResultForm>
      </Card>
    </Grid>
  );
}

/** A form whose thing has gone, which the page says at its top once it's sent. */
export function GoneExample() {
  return (
    <RefusalPlace>
      <Grid>
        <Card span={3}>
          <ResultForm action={() => Promise.resolve(refused("gone"))} says={SAYS} atTop={["gone"]}>
            <SubmitButton variant="ghost" size="small" fit>
              Update for all
            </SubmitButton>
            <Refusal />
          </ResultForm>
        </Card>
      </Grid>
    </RefusalPlace>
  );
}
