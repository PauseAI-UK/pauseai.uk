import type { Metadata } from "next";
import ProsePage from "@/components/ui/ProsePage";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { found } from "@/lib/found";
import { linkPage } from "@/lib/server/email-settings";
import { liftNoBulkNow, resendLinkNow, saveSettingsNow, stopEverythingNow, unsubscribeNow } from "../actions";
import EmailSettings from "../_components/EmailSettings";

export const metadata: Metadata = { title: emailSettingsCopy.settings.title, robots: { index: false } };

type Params = { params: Promise<{ token: string }> };

/** Someone's email settings, from a link we emailed them. */
export default async function EmailSettingsPage({ params }: Params) {
  const state = found(await linkPage((await params).token));
  return (
    <ProsePage>
      <EmailSettings
        opened={state}
        unsubscribe={state.unsubscribe}
        initial={state.view}
        actions={{
          save: saveSettingsNow,
          lift: liftNoBulkNow,
          stopAll: stopEverythingNow,
          unsubscribe: unsubscribeNow,
          resend: resendLinkNow,
        }}
      />
    </ProsePage>
  );
}
