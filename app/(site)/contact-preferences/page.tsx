import type { Metadata } from "next";
import ProsePage from "@/components/ui/ProsePage";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { pageMetadata } from "@/lib/metadata";
import { config } from "@/lib/server/config.server";
import { LINK_DAYS } from "@/lib/supporters/settings-view";
import { askForLinkNow } from "./actions";
import SettingsStart from "./_components/SettingsStart";

export const metadata: Metadata = pageMetadata({
  title: emailSettingsCopy.start.title,
  description: emailSettingsCopy.start.description,
  path: "/contact-preferences",
});

/** Asking for a link to your contact preferences. */
export default function EmailSettingsStartPage() {
  return (
    <ProsePage>
      <SettingsStart ask={askForLinkNow} days={LINK_DAYS} turnstileSiteKey={config.turnstileSiteKey} />
    </ProsePage>
  );
}
