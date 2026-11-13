"use client";

import EmailSettings from "@/app/(site)/contact-preferences/_components/EmailSettings";
import SettingsStart from "@/app/(site)/contact-preferences/_components/SettingsStart";
import type { SettingsView } from "@/lib/email-settings";
import type { Topic } from "@/lib/contact-permissions";
import { Logged } from "../_components/wiring";

/** Asking for a link, its button logging what it would send. */
export function SettingsStartExample() {
  return (
    <Logged>
      {(log) => (
        <SettingsStart
          days={7}
          ask={async (form) => {
            log("ask")(Object.fromEntries(form.entries()));
            return { sent: String(form.get("email")) };
          }}
        />
      )}
    </Logged>
  );
}

/**
 * The page for `view`, or its link run out with none; from an email's
 * unsubscribe link under `unsubscribe`; a number's link, `number`. Each
 * action logs, and gives the page as it was.
 */
export function EmailSettingsExample({
  view,
  unsubscribe = null,
  number = false,
}: {
  view: SettingsView | null;
  unsubscribe?: Topic[] | null;
  number?: boolean;
}) {
  return (
    <Logged>
      {(log) => {
        const same = (name: string) => async (form: FormData) => {
          log(name)(Object.fromEntries(form.entries()));
          return view;
        };
        return (
          <EmailSettings
            opened={{ kind: unsubscribe ? "copy" : "link", token: "example", number }}
            unsubscribe={unsubscribe}
            initial={view}
            actions={{
              save: same("save"),
              lift: same("lift"),
              stopAll: same("stopAll"),
              unsubscribe: async (form) => ({ done: true, view: await same("unsubscribe")(form) }),
              resend: async (form) => void (await same("resend")(form)),
            }}
          />
        );
      }}
    </Logged>
  );
}
