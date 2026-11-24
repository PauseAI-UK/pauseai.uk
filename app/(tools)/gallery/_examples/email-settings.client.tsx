"use client";

import EmailSettings from "@/app/(site)/contact-preferences/_components/EmailSettings";
import { exampleChanged, exampleSaved } from "@/app/(site)/contact-preferences/_components/EmailSettings.examples";
import SettingsStart from "@/app/(site)/contact-preferences/_components/SettingsStart";
import type { SettingsView } from "@/lib/supporters/settings-view";
import type { Topic } from "@/lib/supporters/contact-permissions";
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
            return { ok: true, sent: String(form.get("email")) };
          }}
        />
      )}
    </Logged>
  );
}

/**
 * The page for `view`, or its link run out with none; from an email's
 * unsubscribe link under `unsubscribe`; a number's link, `number`. Each
 * action logs. A save gives the page with its boxes as they were sent, and
 * the others the page as it was.
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
          return exampleChanged(view);
        };
        return (
          <EmailSettings
            opened={{ kind: unsubscribe ? "copy" : "link", token: "example", number }}
            unsubscribe={unsubscribe}
            initial={view}
            actions={{
              save: async (form) => {
                log("save")(Object.fromEntries(form.entries()));
                return exampleChanged(view && exampleSaved(view, form));
              },
              lift: same("lift"),
              stopAll: same("stopAll"),
              unsubscribe: async (form) => {
                log("unsubscribe")(Object.fromEntries(form.entries()));
                return { ok: true, done: true, view };
              },
              resend: same("resend"),
            }}
          />
        );
      }}
    </Logged>
  );
}
