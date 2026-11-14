import { Button, buttonClass } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { EmailBlock } from "@/lib/server/email.server";
import Bubble from "@/components/ui/Bubble";
import styles from "./UnblockForm.module.css";

const copy = staffCopy.emails;

type Props = {
  block: Pick<EmailBlock, "address" | "canReset">;
  action: (form: FormData) => void | Promise<void>;
};

/**
 * Unblocks an address, with a note of why for the audit log, which it
 * won't send without: on a politician's page. The field has no label above
 * it; its question is in it, and is its name. A complaint can't be
 * unblocked.
 */
export default function UnblockForm({ block, action }: Props) {
  if (!block.canReset) return <Muted>{copy.cantReset}</Muted>;
  return (
    <FilterForm action={action} aria-label={`${copy.unblock}: ${block.address}`} className={styles.form}>
      <input type="hidden" name="address" value={block.address} />
      <span className={styles.why}>
        <TextInput name="note" required aria-label={copy.note} placeholder={copy.note} />
      </span>
      <SubmitButton variant="ghost" size="small" fit>
        {copy.unblock}
      </SubmitButton>
    </FilterForm>
  );
}

/**
 * A row's way to unblock its address, in a list of blocked addresses: a
 * button that opens a bubble under it, over the table (ui/Bubble), so the
 * row holds no field. The bubble asks why, for the audit log, and won't
 * send without; Unblock there unblocks the address, and Cancel closes the
 * bubble. A complaint can't be unblocked.
 */
export function UnblockBubble({ block, action }: Props) {
  if (!block.canReset) {
    return (
      <span className={styles.cant}>
        <Muted>{copy.cantReset}</Muted>
      </span>
    );
  }
  const id = `unblock-${block.address.replace(/\W/g, "-")}`;
  return (
    <Bubble id={id} trigger={buttonClass({ variant: "ghost", size: "small", fit: true })} label={copy.unblockOpen}>
      <form action={action} aria-label={`${copy.unblock}: ${block.address}`} className={styles.asking}>
        <input type="hidden" name="address" value={block.address} />
        <Field label={copy.note}>
          <TextInput name="note" required />
        </Field>
        <span className={styles.buttons}>
          <SubmitButton variant="primary" size="small" fit>
            {copy.unblock}
          </SubmitButton>
          <Button variant="ghost" size="small" fit type="button" popoverTarget={id} popoverTargetAction="hide">
            {copy.cancel}
          </Button>
        </span>
      </form>
    </Bubble>
  );
}
