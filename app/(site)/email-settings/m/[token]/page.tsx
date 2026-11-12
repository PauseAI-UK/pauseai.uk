import type { Metadata } from "next";
import ProsePage from "@/components/ui/ProsePage";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { found } from "@/lib/found";
import { copyPage } from "@/lib/server/email-settings";
import { liftNoBulkNow, resendLinkNow, saveSettingsNow, stopEverythingNow, unsubscribeNow } from "../../actions";
import EmailSettings from "../../_components/EmailSettings";

export const metadata: Metadata = { title: emailSettingsCopy.settings.title, robots: { index: false } };

type Params = { params: Promise<{ token: string }> };

/** Someone's email settings, from the unsubscribe link in one of our emails, with its button first. */
export default async function EmailSettingsFromCopyPage({ params }: Params) {
  const state = found(await copyPage((await params).token));
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
