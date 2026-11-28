"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copy, type Campaign } from "@/lib/content/email-your-mp";
import type { CampaignLetter } from "@/lib/email-your-mp";
import { campaignPath } from "@/lib/content/campaigns";
import { CONTROLAI_LETTER_PAGE, signedControlAiLetter, SOBEL_BILL_CAMPAIGN } from "@/lib/controlai-letter";
import { readDraft, readLookup, type Draft, type Lookup } from "./draft.client";
import LetterForm from "./LetterForm";
import MpCard from "./MpCard";
import { Column, Notice } from "./FormParts";

type Writing = { lookup: Lookup | Draft; draft?: Draft };

/**
 * The page for writing the letter, after "Find my MP": the MP, then the
 * form, starting from `letter`, the version staff last published. Carries
 * on with the draft when coming back from the preview. With no version
 * published yet, it says the campaign isn't open.
 */
export default function LetterWrite({ campaign, letter }: { campaign: Campaign; letter: CampaignLetter | null }) {
  const campaignSlug = campaign.slug;
  // undefined until it's been read from sessionStorage, null if there's no lookup.
  const [writing, setWriting] = useState<Writing | null>();

  useEffect(() => {
    const draft = readDraft(campaignSlug);
    const lookup = readLookup(campaignSlug);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- once, on load, from sessionStorage, which the server render couldn't read
    setWriting(draft ? { lookup: draft, draft } : lookup && { lookup });
  }, [campaignSlug]);

  if (!letter) {
    return (
      <Column>
        <p>{copy.write.notOpen}</p>
      </Column>
    );
  }
  if (writing === undefined) return null;
  if (writing === null) {
    return (
      <Column>
        <p>{copy.write.none}</p>
        <p>
          <Link href={`${campaignPath(campaign)}#email-your-mp`}>{copy.preview.backToForm}</Link>
        </p>
      </Column>
    );
  }
  const { lookup, draft } = writing;
  return (
    <Column>
      <MpCard mp={lookup.mp} />
      {campaign.slug === SOBEL_BILL_CAMPAIGN && signedControlAiLetter(lookup.statuses) && (
        <Notice>
          {copy.sobelBill.signedNote.before}
          <a href={CONTROLAI_LETTER_PAGE}>{copy.sobelBill.signedNote.link}</a>
          {copy.sobelBill.signedNote.after}
        </Notice>
      )}
      <LetterForm
        campaign={campaign}
        letter={letter}
        mp={lookup.mp}
        statuses={lookup.statuses}
        senderName={lookup.name}
        address={lookup.address}
        postcode={lookup.postcode}
        draft={draft}
      />
    </Column>
  );
}
