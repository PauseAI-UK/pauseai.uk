"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import Turnstile from "@/components/ui/Turnstile";
import { emailSettingsCopy as copy } from "@/lib/content/email-settings";
import { focusOnMount } from "./EmailSettings";
import styles from "./EmailSettings.module.css";

/**
 * Asking for a link to your settings: your address, past Turnstile when the
 * site has it, and Email me a link; then that we've sent it, if we have the
 * address, without saying whether we do. `days` is how long the link works.
 */
export default function SettingsStart({
  ask,
  days,
  turnstileSiteKey,
}: {
  ask: (form: FormData) => Promise<{ sent: string } | { message: string }>;
  days: number;
  turnstileSiteKey?: string;
}) {
  const [sent, setSent] = useState<string>();
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  // Bumped after each try to remount Turnstile: its tokens are single use.
  const [round, setRound] = useState(0);
  if (sent !== undefined) {
    return (
      <>
        <h1 ref={focusOnMount} tabIndex={-1}>
          {copy.sent.title}
        </h1>
        <p className={styles.lead}>{copy.sent.body(sent, days)}</p>
        <p className={styles.quiet}>{copy.sent.again}</p>
      </>
    );
  }
  return (
    <>
      <h1>{copy.start.title}</h1>
      <p className={styles.lead}>{copy.start.lead}</p>
      <FormStack
        className={styles.card}
        action={async (form) => {
          const result = await ask(form);
          if ("sent" in result) setSent(result.sent);
          else {
            setMessage(result.message);
            setToken("");
            setRound((n) => n + 1);
          }
        }}
      >
        <Field label={copy.start.label}>
          <TextInput name="email" type="email" required autoComplete="email" />
        </Field>
        <input type="hidden" name="turnstileToken" value={token} />
        {turnstileSiteKey && <Turnstile key={round} siteKey={turnstileSiteKey} onToken={setToken} />}
        {message && (
          <p role="alert" className={styles.alert}>
            {message}
          </p>
        )}
        <SubmitButton variant="primary" fit disabled={Boolean(turnstileSiteKey) && !token}>
          {copy.start.button}
        </SubmitButton>
      </FormStack>
      <p className={styles.quiet}>{copy.start.also}</p>
    </>
  );
}
