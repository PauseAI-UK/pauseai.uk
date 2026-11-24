import { Button, buttonClass } from "@/components/ui/Button";
import { Field, FieldGroup } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import type { EmailBlock } from "@/lib/email/email.server";
import type { FormResult } from "@/lib/form-result";
import Bubble from "@/components/ui/Bubble";
import { Refusal, RefusedTextInput, ResultForm } from "../ui/ResultForm";
import styles from "./UnblockForm.module.css";
import { emailCopy } from "./copy";

const copy = emailCopy.emails;

/** The Server Action that unblocks an address: refused without a note of why. */
export type Unblock = (form: FormData) => Promise<FormResult<"blank">>;

type Props = {
  block: Pick<EmailBlock, "address" | "canReset"> & { kind: string };
  action: Unblock;
};

/** Why staff can't unblock it: a complaint, or a bounce the provider won't send to again. */
const cantWords = ({ kind }: { kind: string }) => copy.cantReset[kind === "complaint" ? "complaint" : "provider"];

/**
 * Unblocks an address, with a note of why for the audit log, which it
 * won't send without: on a politician's page. The field has no label above
 * it; its question is in it, and is its name. A note of nothing but spaces
 * is refused under the field and its button. What can't be unblocked says
 * why instead (cantWords).
 */
export default function UnblockForm({ block, action }: Props) {
  if (!block.canReset) return <Muted>{cantWords(block)}</Muted>;
  return (
    <ResultForm
      action={action}
      says={emailCopy.unblockRefused}
      aria-label={`${copy.unblock}: ${block.address}`}
      className={styles.form}
    >
      <input type="hidden" name="address" value={block.address} />
      <span className={styles.row}>
        <span className={styles.why}>
          <RefusedTextInput name="note" required aria-label={copy.note} placeholder={copy.note} wrong={["blank"]} />
        </span>
        <SubmitButton variant="ghost" size="small" fit>
          {copy.unblock}
        </SubmitButton>
      </span>
      <Refusal />
    </ResultForm>
  );
}

/**
 * A row's way to unblock its address, in a list of blocked addresses: a
 * button that opens a bubble under it, over the table (ui/Bubble), so the
 * row holds no field. The bubble asks why, for the audit log, and won't
 * send without, refusing a note of nothing but spaces under its field;
 * Unblock there unblocks the address, and Cancel closes the bubble. What
 * can't be unblocked says why instead (cantWords).
 */
export function UnblockBubble({ block, action }: Props) {
  if (!block.canReset) {
    return (
      <span className={styles.cant}>
        <Muted>{cantWords(block)}</Muted>
      </span>
    );
  }
  const id = `unblock-${block.address.replace(/\W/g, "-")}`;
  return (
    <Bubble id={id} trigger={buttonClass({ variant: "ghost", size: "small", fit: true })} label={copy.unblockOpen}>
      <ResultForm
        action={action}
        says={emailCopy.unblockRefused}
        aria-label={`${copy.unblock}: ${block.address}`}
        className={styles.asking}
      >
        <input type="hidden" name="address" value={block.address} />
        <FieldGroup>
          <Field label={copy.note}>
            <RefusedTextInput name="note" required wrong={["blank"]} />
          </Field>
          <Refusal />
        </FieldGroup>
        <span className={styles.buttons}>
          <SubmitButton variant="primary" size="small" fit>
            {copy.unblock}
          </SubmitButton>
          <Button variant="ghost" size="small" fit type="button" popoverTarget={id} popoverTargetAction="hide">
            {copy.cancel}
          </Button>
        </span>
      </ResultForm>
    </Bubble>
  );
}
