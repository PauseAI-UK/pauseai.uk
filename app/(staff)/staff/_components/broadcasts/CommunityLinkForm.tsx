"use client";

import { useRef } from "react";
import { TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import type { FormResult } from "@/lib/form-result";
import { Refusal, ResultForm } from "../ui/ResultForm";

const copy = waitingRoomCopy.page;

/** The form for a new community link, in the bubble of the page's button, which closes once it's saved. */
export default function CommunityLinkForm({
  setLink,
}: {
  setLink: (form: FormData) => Promise<FormResult<"not-a-link">>;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <ResultForm
      ref={form}
      action={setLink}
      says={copy.refused}
      stack
      done={() => form.current!.closest<HTMLElement>("[popover]")!.hidePopover()}
    >
      <Field label={copy.link.label}>
        <TextInput name="link" type="url" required aria-describedby="waiting-room-link-hint" />
      </Field>
      <Hint id="waiting-room-link-hint">{copy.link.hint}</Hint>
      <Refusal />
      <div>
        <SubmitButton variant="primary" size="small">
          {copy.link.save}
        </SubmitButton>
      </div>
    </ResultForm>
  );
}
