// The staff interface's letters to MPs: the list and its filters, a letter's
// page, thread and history, and the blocked addresses, on fake letters.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import type { Group } from "../_components/types";
import { campaignNameGallery } from "@/app/(staff)/staff/_components/CampaignName.gallery";
import { emailProblemsTableGallery } from "@/app/(staff)/staff/_components/oversight/EmailProblemsTable.gallery";
import { emailBlockFiltersGallery } from "@/app/(staff)/staff/_components/email/EmailBlockFilters.gallery";
import { unblockFormGallery } from "@/app/(staff)/staff/_components/email/UnblockForm.gallery";
import { emailBlocksTableGallery } from "@/app/(staff)/staff/_components/oversight/EmailBlocksTable.gallery";
import { bounceReasonGallery } from "@/app/(staff)/staff/_components/email/BounceReason.gallery";
import { campaignsOverviewGallery } from "@/app/(staff)/staff/_components/mailings/CampaignsOverview.gallery";
import { mailEmailGallery } from "@/app/(staff)/staff/_components/mailings/MailEmail.gallery";
import { campaignLetterGallery } from "@/app/(staff)/staff/_components/mailings/CampaignLetter.gallery";
import { campaignViewGallery } from "@/app/(staff)/staff/_components/mailings/CampaignView.gallery";
import { letterThreadGallery } from "@/app/(staff)/staff/_components/letters/LetterThread.gallery";
import { threadEmailGallery } from "@/app/(staff)/staff/_components/letters/ThreadEmail.gallery";
import { letterChangesGallery } from "@/app/(staff)/staff/_components/letters/LetterChanges.gallery";
import { mailFoldGallery } from "@/app/(staff)/staff/_components/letters/MailFold.gallery";
import { oneOffListGallery } from "@/app/(staff)/staff/_components/letters/OneOffList.gallery";
import { oneOffThreadViewGallery } from "@/app/(staff)/staff/_components/letters/OneOffThreadView.gallery";
import { allLettersGallery } from "@/app/(staff)/staff/_components/letters/AllLetters.gallery";
import { threadTextGallery } from "@/app/(staff)/staff/_components/letters/ThreadText.gallery";
import { lettersTableGallery } from "@/app/(staff)/staff/_components/letters/LettersTable.gallery";
import { letterViewGallery } from "@/app/(staff)/staff/_components/letters/LetterView.gallery";
import { letterStatusGallery } from "@/app/(staff)/staff/_components/letters/LetterStatus.gallery";
import { letterHistoryGallery } from "@/app/(staff)/staff/_components/letters/LetterHistory.gallery";
import { findInGmailGallery } from "@/app/(staff)/staff/_components/letters/FindInGmail.gallery";
import { letterLinkGallery } from "@/app/(staff)/staff/_components/letters/LetterLink.gallery";

export const staffLetters: Group = {
  id: "staff-letters",
  title: "The staff interface: letters",
  examples: [
    ...letterThreadGallery,
    ...threadEmailGallery,
    ...letterChangesGallery,
    ...mailFoldGallery,
    ...bounceReasonGallery,
    ...emailBlocksTableGallery,
    ...unblockFormGallery,
    ...emailBlockFiltersGallery,
    ...emailProblemsTableGallery,
    ...campaignsOverviewGallery,
    ...mailEmailGallery,
    ...campaignLetterGallery,
    ...campaignViewGallery,
    ...oneOffListGallery,
    ...oneOffThreadViewGallery,
    ...allLettersGallery,
    ...threadTextGallery,
    ...lettersTableGallery,
    ...letterViewGallery,
    ...letterStatusGallery,
    ...letterHistoryGallery,
    ...findInGmailGallery,
    ...campaignNameGallery,
    ...letterLinkGallery,
  ],
};
