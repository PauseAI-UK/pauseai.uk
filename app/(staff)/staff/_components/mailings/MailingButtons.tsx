"use client";

import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormResult } from "@/lib/form-result";
import { DeleteTwice } from "../ui/DeleteTwice";
import { Refusal, ResultForm } from "../ui/ResultForm";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;

/**
 * What a button here sends, as a ResultForm takes it: its Server Action,
 * its feature's words for each reason the action refuses it for (`says`),
 * and those of the reasons said at the page's top (`atTop`), as the page
 * catching up takes the button away.
 */
export type Sends<Reason extends string> = {
  action: (form: FormData) => Promise<FormResult<Reason>>;
  says: Record<Reason, string>;
  atTop?: readonly Reason[];
};

/** A form of one button (`children`), which sends `id`. Refused, it says why under the button, or at the page's top. */
function IdForm<Reason extends string>({
  id,
  action,
  says,
  atTop,
  children,
}: { id: number; children: ReactNode } & Sends<Reason>) {
  return (
    <ResultForm action={action} says={says} atTop={atTop}>
      <input type="hidden" name="id" value={id} />
      {children}
      <Refusal />
    </ResultForm>
  );
}

/** Delete draft, pressed twice, for draft `id`. A draft has sent nothing, so it isn't kept. */
export function DeleteDraft<Reason extends string = never>({ id, ...sends }: { id: number } & Sends<Reason>) {
  return <DeleteTwice name="id" value={String(id)} label={copy.deleteDraft} {...sends} />;
}

/** Copy mailing or Copy broadcast, `label`, for mailing `id`: quiet, at its page's top right. */
export function CopyMailing<Reason extends string = never>({
  label,
  ...sends
}: { id: number; label: string } & Sends<Reason>) {
  return (
    <IdForm {...sends}>
      <SubmitButton variant="ghost" size="small" fit>
        {label}
      </SubmitButton>
    </IdForm>
  );
}

/** Resume sending, for broadcast `id`, which stopped before it had all gone: small, beside what says so. */
export function ResumeBroadcast<Reason extends string = never>(sends: { id: number } & Sends<Reason>) {
  return (
    <IdForm {...sends}>
      <SubmitButton variant="ghost" size="small" fit>
        {mailingsCopy.mailingPages.resume}
      </SubmitButton>
    </IdForm>
  );
}

/**
 * Unschedule or Stop sending, for mailing `id`: a scheduled one becomes a
 * draft again, one sending sends no more. Small in a list; `full`, the full
 * height, on the mailing's own page.
 */
export function StopMailing<Reason extends string = never>({
  label,
  full = false,
  ...sends
}: {
  id: number;
  label: string;
  full?: boolean;
} & Sends<Reason>) {
  return (
    <IdForm {...sends}>
      <SubmitButton variant="primary" size={full ? undefined : "small"} fit>
        {label}
      </SubmitButton>
    </IdForm>
  );
}
