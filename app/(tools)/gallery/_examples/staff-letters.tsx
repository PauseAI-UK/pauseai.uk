// The staff interface's letters to MPs: the list and its filters, a letter's
// page, thread and history, and the blocked addresses, on fake letters.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import EmailBlockFilters from "@/app/(staff)/staff/_components/EmailBlockFilters";
import { exampleProblems } from "@/app/(staff)/staff/_components/EmailBlocksTable.examples";
import EmailProblemsTable from "@/app/(staff)/staff/_components/EmailProblemsTable";
import CampaignName from "@/app/(staff)/staff/_components/CampaignName";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { campaigns } from "@/lib/content/email-your-mp";
import BounceReason from "@/app/(staff)/staff/_components/BounceReason";
import type { Group } from "../_components/types";
import { EmailBlocksTableExample, UnblockBubbleExample, UnblockFormExample } from "./staff.client";
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

const [pm] = campaigns;

export const staffLetters: Group = {
  id: "staff-letters",
  title: "The staff interface: letters",
  examples: [
    ...letterThreadGallery,
    ...threadEmailGallery,
    ...letterChangesGallery,
    ...mailFoldGallery,
    {
      name: "BounceReason",
      file: "app/(staff)/staff/_components/BounceReason.tsx",
      variants: [
        {
          label: "Postmark's, a long one found in someone's Gmail, folded to its first sentence, and a hold in CiviCRM",
          render: () => (
            <StaffPage as="div">
              <div>
                <BounceReason reason="Unknown user" kind="hard" foundInGmail={false} />
              </div>
              <div>
                <BounceReason
                  reason="550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking the recipient's email address for typos. https://support.google.com/mail/?p=NoSuchUser - gsmtp"
                  kind="hard"
                  foundInGmail
                />
              </div>
              <div>
                <BounceReason reason="CiviCRM has the address on hold" kind="hold" foundInGmail={false} />
              </div>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "EmailBlocksTable",
      file: "app/(staff)/staff/_components/EmailBlocksTable.tsx",
      variants: [
        {
          label: "An MP's address that bounced, and one that complained",
          render: () => (
            <StaffPage as="div">
              <EmailBlocksTableExample />
            </StaffPage>
          ),
        },
        {
          label: "Without the supporters permission: the letter named, not linked",
          render: () => (
            <StaffPage as="div">
              <EmailBlocksTableExample letterLinks={false} />
            </StaffPage>
          ),
        },
        {
          label: "None",
          render: () => (
            <StaffPage as="div">
              <EmailBlocksTableExample blocks={[]} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "UnblockForm",
      file: "app/(staff)/staff/_components/UnblockForm.tsx",
      variants: [
        {
          label: "For a bounce, and for a complaint, which can't be unblocked",
          render: () => (
            <StaffPage as="div">
              <UnblockFormExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "UnblockBubble",
      file: "app/(staff)/staff/_components/UnblockForm.tsx",
      variants: [
        {
          label:
            "In a list's row: a button that opens the bubble asking why; and a complaint, which can't be unblocked",
          render: () => (
            <StaffPage as="div">
              <UnblockBubbleExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "EmailBlockFilters",
      file: "app/(staff)/staff/_components/EmailBlockFilters.tsx",
      variants: [
        {
          label: "All, and complaints to a search",
          render: () => (
            <StaffPage as="div">
              <EmailBlockFilters q="" kind="" action="/staff/politicians/addresses-to-fix" />
              <EmailBlockFilters q="example.org" kind="complaint" action="/staff/politicians/addresses-to-fix" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "EmailProblemsTable",
      file: "app/(staff)/staff/_components/EmailProblemsTable.tsx",
      variants: [
        {
          label: "A letter's hard bounce, a forwarded reply's soft one, and a complaint about an email we didn't log",
          render: () => (
            <StaffPage as="div">
              <EmailProblemsTable problems={exampleProblems} letterLinks />
            </StaffPage>
          ),
        },
        {
          label: "Without the supporters permission: the letter named, not linked",
          render: () => (
            <StaffPage as="div">
              <EmailProblemsTable problems={exampleProblems} letterLinks={false} />
            </StaffPage>
          ),
        },
        {
          label: "None",
          render: () => (
            <StaffPage as="div">
              <EmailProblemsTable problems={[]} letterLinks />
            </StaffPage>
          ),
        },
      ],
    },
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
    {
      name: "CampaignName",
      file: "app/(staff)/staff/_components/CampaignName.tsx",
      variants: [
        {
          label: "Leading to its page, by its name or its slug; and plain, for staff who can't open it",
          render: () => (
            <StaffPage as="div">
              <p>
                <CampaignName slug={pm.slug} /> · <CampaignName slug="old-campaign" /> ·{" "}
                <CampaignName slug={pm.slug} linked={false} />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    ...letterLinkGallery,
  ],
};
