import { codeCampaign } from "@/lib/email-your-mp";
import { config } from "@/lib/server/config.server";
import { copy } from "@/lib/content/email-your-mp";
import { pageMetadata } from "@/lib/metadata";
import LetterPreview from "../../_components/LetterPreview";
import LetterStep from "../../_components/LetterStep";

const campaign = codeCampaign("support-sobel-bill");

// The letter from this campaign's form, before it's sent. Unlisted, and kept out of search.
export const metadata = {
  ...pageMetadata({
    title: copy.preview.title,
    description: copy.preview.title,
    path: "/campaigns/support-sobel-bill/preview",
  }),
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <LetterStep title={copy.preview.title}>
      <LetterPreview campaign={campaign} turnstileSiteKey={config.turnstileSiteKey} />
    </LetterStep>
  );
}
