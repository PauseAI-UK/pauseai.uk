// The staff interface's letters to MPs: the list and its filters, a letter's
// page, thread and history, and the blocked addresses, on fake letters.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import EmailBlockFilters from "@/app/(staff)/staff/_components/EmailBlockFilters";
import { exampleProblems } from "@/app/(staff)/staff/_components/EmailBlocksTable.examples";
import EmailProblemsTable from "@/app/(staff)/staff/_components/EmailProblemsTable";
import CampaignName from "@/app/(staff)/staff/_components/CampaignName";
import LetterLink from "@/app/(staff)/staff/_components/LetterLink";
import AllLetters from "@/app/(staff)/staff/_components/AllLetters";
import LettersTable from "@/app/(staff)/staff/_components/LettersTable";
import ThreadText from "@/app/(staff)/staff/_components/ThreadText";
import LetterStatus from "@/app/(staff)/staff/_components/LetterStatus";
import { OneOffTable } from "@/app/(staff)/staff/_components/OneOffList";
import OneOffThreadView from "@/app/(staff)/staff/_components/OneOffThreadView";
import {
  exampleAutoRepliedLetterDetails,
  exampleLetter,
  examplePauseaiLetterDetails,
  exampleOlderRepliedLetterDetails,
  exampleProxiedLetterDetails,
  exampleRepliedLetterDetails,
  exampleSupporterLetterDetails,
} from "@/app/(staff)/staff/_components/LettersTable.examples";
import { historyOf, LetterHistory } from "@/app/(staff)/staff/_components/LetterHistory";
import FindInGmail from "@/app/(staff)/staff/_components/FindInGmail";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { campaigns } from "@/lib/content/email-your-mp";
import BounceReason from "@/app/(staff)/staff/_components/BounceReason";
import LetterChanges from "@/app/(staff)/staff/_components/LetterChanges";
import MailFold from "@/app/(staff)/staff/_components/MailFold";
import { MessageText, Thread } from "@/app/(staff)/staff/_components/LetterThread";
import { staffCopy } from "@/lib/content/staff-interface";
import ThreadEmail from "@/app/(staff)/staff/_components/ThreadEmail";
import LetterThread, { SupporterLetterThread } from "@/app/(staff)/staff/_components/LetterThread";
import { exampleImportedThread, exampleThread } from "@/app/(staff)/staff/_components/LetterThread.examples";
import type { Group } from "../_components/types";
import {
  EmailBlocksTableExample,
  MailingLetterViewExample,
  SupporterLetterViewExample,
  UnblockBubbleExample,
  UnblockFormExample,
} from "./staff.client";
import {
  exampleForwardThread,
  exampleHiddenOneOff,
  exampleOneOffThread,
  exampleOneOffs,
} from "@/app/(staff)/staff/_components/OneOffList.examples";
import { campaignsOverviewGallery } from "@/app/(staff)/staff/_components/mailings/CampaignsOverview.gallery";
import { mailEmailGallery } from "@/app/(staff)/staff/_components/mailings/MailEmail.gallery";
import { campaignLetterGallery } from "@/app/(staff)/staff/_components/mailings/CampaignLetter.gallery";
import { campaignViewGallery } from "@/app/(staff)/staff/_components/mailings/CampaignView.gallery";

const [pm] = campaigns;

/** Who a letter in the examples is from and to, when, and its subject. */
const EXAMPLE_EMAIL = {
  from: "Jane Smith <jane@example.com>",
  to: "Testy McTestface MP <testy.mctestface.mp@parliament.uk>",
  at: new Date("2026-10-12T09:05:00Z"),
  subject: "Please back a pause on frontier AI",
};

export const staffLetters: Group = {
  id: "staff-letters",
  title: "The staff interface: letters",
  examples: [
    {
      name: "LetterThread",
      file: "app/(staff)/staff/_components/LetterThread.tsx",
      variants: [
        {
          label: "Sent from Jo's Gmail: Polly's answer, and Jo's that can't be read",
          render: () => (
            <StaffPage as="div">
              <LetterThread thread={exampleThread} />
            </StaffPage>
          ),
        },
        {
          label: "Imported from Airtable, never sent: no text, no replies",
          render: () => (
            <StaffPage as="div">
              <LetterThread thread={exampleImportedThread} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SupporterLetterThread",
      file: "app/(staff)/staff/_components/LetterThread.tsx",
      variants: [
        {
          label:
            "A supporter's letter, from them, leading to their supporter page: no text, which is in the policy inbox",
          render: () => (
            <StaffPage as="div">
              <SupporterLetterThread letter={exampleSupporterLetterDetails} />
            </StaffPage>
          ),
        },
        {
          label:
            "A letter from the letters inbox: its changes to the draft, then the office's reply and the supporter's answer",
          render: () => (
            <StaffPage as="div">
              <SupporterLetterThread letter={exampleProxiedLetterDetails} />
            </StaffPage>
          ),
        },
        {
          label:
            "Only automatic replies: the office's folded to its first paragraph, the supporter's one paragraph whole",
          render: () => (
            <StaffPage as="div">
              <SupporterLetterThread letter={exampleAutoRepliedLetterDetails} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageText",
      file: "app/(staff)/staff/_components/LetterThread.tsx",
      variants: [
        {
          label: "A reply, the mail it quotes folded under it",
          render: () => (
            <StaffPage as="div">
              <MessageText
                text={"Dear Jo,\n\nYes, I'd be glad to meet."}
                quoted={"On 5 Jun 2026, Jo wrote:\n> Will you?"}
              />
            </StaffPage>
          ),
        },
        {
          label: "An automatic reply of four paragraphs, folded to its first",
          render: () => {
            const reply = exampleAutoRepliedLetterDetails.messages[0];
            return (
              <StaffPage as="div">
                <MessageText text={reply.text!} quoted="" auto />
              </StaffPage>
            );
          },
        },
      ],
    },
    {
      name: "Thread",
      file: "app/(staff)/staff/_components/LetterThread.tsx",
      variants: [
        {
          label: "A thread's section: its heading, a link at its right, over its messages",
          render: () => (
            <StaffPage as="div">
              <Thread link={<a href="#">Open in Gmail</a>}>
                <ThreadEmail {...EXAMPLE_EMAIL}>Dear Mr McTestface, thank you.</ThreadEmail>
              </Thread>
            </StaffPage>
          ),
        },
        {
          label: "Titled as a broadcast's message is",
          render: () => (
            <StaffPage as="div">
              <Thread title={staffCopy.broadcastPages.threadTitle}>
                <ThreadEmail {...EXAMPLE_EMAIL}>Hi Jane, the march meets at 11:00.</ThreadEmail>
              </Thread>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ThreadEmail",
      file: "app/(staff)/staff/_components/ThreadEmail.tsx",
      variants: [
        {
          label: "A message of a thread: who from and to, when, its subject with an action at its right, over its text",
          render: () => (
            <StaffPage as="div">
              <ThreadEmail {...EXAMPLE_EMAIL} action={<a href="#">An action</a>}>
                Dear Mr McTestface, thank you.
              </ThreadEmail>
            </StaffPage>
          ),
        },
        {
          label: "One whose text isn't kept: no date, and a tinted body for the note in its place",
          render: () => (
            <StaffPage as="div">
              <ThreadEmail {...EXAMPLE_EMAIL} at={null} missing>
                {"The letter's text isn't kept."}
              </ThreadEmail>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "LetterChanges",
      file: "app/(staff)/staff/_components/LetterChanges.tsx",
      variants: [
        {
          label:
            "Only what the supporter changed in a long letter, the paragraphs they left alone folded; Show as sent above",
          render: () => (
            <StaffPage as="div">
              <LetterChanges
                {...EXAMPLE_EMAIL}
                sent={exampleProxiedLetterDetails.sent!.text}
                draft={exampleProxiedLetterDetails.sent!.draft}
              />
            </StaffPage>
          ),
        },
        {
          label: "No draft kept: the letter alone",
          render: () => (
            <StaffPage as="div">
              <LetterChanges {...EXAMPLE_EMAIL} sent={exampleProxiedLetterDetails.sent!.text} draft={null} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailFold",
      file: "app/(staff)/staff/_components/MailFold.tsx",
      variants: [
        {
          label: "Folded, as it first shows",
          render: () => (
            <StaffPage as="div">
              <MailFold summary="2 paragraphs unchanged">{"Dear Jo,\n\nI'm writing about the bill."}</MailFold>
            </StaffPage>
          ),
        },
      ],
    },
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
    {
      name: "OneOffTable",
      file: "app/(staff)/staff/_components/OneOffList.tsx",
      variants: [
        {
          label: "On a person's page",
          render: () => (
            <StaffPage as="div">
              <OneOffTable threads={exampleOneOffs} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "OneOffThreadView",
      file: "app/(staff)/staff/_components/OneOffThreadView.tsx",
      variants: [
        {
          label: "A thread of three: one unreadable, and an automatic reply folded to its first paragraph",
          render: () => (
            <StaffPage as="div">
              <OneOffThreadView thread={exampleOneOffThread} />
            </StaffPage>
          ),
        },
        {
          label:
            "A forward: the letter and the MP's answer it carries rebuilt before it, with the MP it's linked to beside it",
          render: () => (
            <StaffPage as="div">
              <OneOffThreadView thread={exampleForwardThread} />
            </StaffPage>
          ),
        },
        {
          label: "Hidden from staff without supporters",
          render: () => (
            <StaffPage as="div">
              <OneOffThreadView thread={{ ...exampleHiddenOneOff, messages_: null }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AllLetters",
      file: "app/(staff)/staff/_components/AllLetters.tsx",
      variants: [
        {
          label:
            "A supporter's letter with a reply, one of PauseAI's not sent and a one-off thread, filtered to the last 30 days",
          render: () => (
            <StaffPage as="div">
              <AllLetters
                found={{
                  letters: [
                    {
                      id: 1,
                      kind: "supporter",
                      status: "sent",
                      sentAt: new Date("2026-10-20T10:00:00Z"),
                      repliedAt: new Date("2026-10-21T10:00:00Z"),
                      replies: 1,
                      people: [{ id: 1, name: "Polly Placeholder" }],
                      senderName: "Jane Smith",
                      senderEmail: "jane.smith@example.com",
                      supporterId: 1,
                      campaign: "regulate-letter-pm",
                      campaignTitle: "Regulate AI",
                    },
                    {
                      id: 2,
                      kind: "pauseai",
                      status: "scheduled",
                      sentAt: null,
                      repliedAt: null,
                      replies: 0,
                      people: [{ id: 1, name: "Polly Placeholder" }],
                      mailingId: 3,
                      mailingTitle: "A letter about the march",
                    },
                    {
                      id: 3,
                      kind: "one-off",
                      status: "one-off",
                      sentAt: new Date("2026-10-19T10:00:00Z"),
                      repliedAt: null,
                      replies: 0,
                      people: [{ id: 1, name: "Polly Placeholder" }],
                      senderName: "Sam Jones",
                      senderEmail: "sam@example.com",
                      fromUs: false,
                      recipients: [{ name: "", politicianId: null, pauseai: true }],
                      subject: "Coffee next week?",
                    },
                  ],
                  total: 3,
                  pages: 1,
                }}
                search={{
                  q: "",
                  from: [],
                  type: [],
                  to: [],
                  sent: "30",
                  replied: "",
                  flag: [],
                  sort: "",
                  dir: "",
                  page: "",
                }}
                people={[{ id: 1, name: "Polly Placeholder", constituency: "Cities of London and Westminster" }]}
                supporters
                inbox="policy@example.org"
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ThreadText",
      file: "app/(staff)/staff/_components/ThreadText.tsx",
      variants: [
        {
          label: "An email's plain text, with bold and a link",
          render: () => (
            <StaffPage as="div">
              <ThreadText text={"Dear Jane,\n\n*Our letter is out: https://example.org/letter*\n\nKind regards"} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "LettersTable",
      file: "app/(staff)/staff/_components/LettersTable.tsx",
      variants: [
        {
          label:
            "A bounced letter to a test MP, a replied one, one with only an automatic reply, and one not sent as the MP's address was blocked",
          render: () => (
            <StaffPage as="div">
              <LettersTable
                letters={[
                  exampleLetter,
                  {
                    ...exampleLetter,
                    id: 2,
                    status: "sent",
                    senderName: "Example Sender",
                    senderEmail: "sender@example.org",
                    mpName: "Polly Placeholder",
                    isTest: false,
                    repliedAt: new Date("2026-10-13T09:00:00Z"),
                    events: [
                      { at: new Date("2026-10-12T09:00:00Z"), status: "sending", details: {} },
                      { at: new Date("2026-10-12T09:05:00Z"), status: "sent", details: {} },
                    ],
                  },
                  {
                    ...exampleLetter,
                    id: 4,
                    status: "sent",
                    senderName: "Sam Jones",
                    senderEmail: "sam@example.org",
                    mpName: "Polly Placeholder",
                    isTest: false,
                    autoRepliedAt: new Date("2026-10-12T09:06:00Z"),
                    events: [
                      { at: new Date("2026-10-12T09:06:00Z"), status: "auto_reply", details: {} },
                      { at: new Date("2026-10-12T09:05:00Z"), status: "sent", details: {} },
                      { at: new Date("2026-10-12T09:00:00Z"), status: "sending", details: {} },
                    ],
                  },
                  {
                    ...exampleLetter,
                    id: 3,
                    status: "not_sent",
                    mpName: "Bouncy McTestface MP",
                    backend: null,
                    sentAt: null,
                    events: [
                      { at: new Date("2026-10-12T09:00:00Z"), status: "sending", details: {} },
                      { at: new Date("2026-10-12T09:00:00Z"), status: "not_sent", details: {} },
                    ],
                  },
                ]}
              />
            </StaffPage>
          ),
        },
        {
          label: "None",
          render: () => (
            <StaffPage as="div">
              <LettersTable letters={[]} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "LetterView",
      file: "app/(staff)/staff/_components/LetterView.tsx",
      variants: [
        {
          label: "A mailing's letter and its reply, beside the ask, as a politician's page has it, and its history",
          render: () => (
            <StaffPage as="div">
              <MailingLetterViewExample />
            </StaffPage>
          ),
        },
        {
          label: "A supporter's letter to a test MP that bounced, beside its campaign's ask, not yet answered",
          render: () => (
            <StaffPage as="div">
              <SupporterLetterViewExample ask />
            </StaffPage>
          ),
        },
        {
          label: "One whose campaign makes no ask: the campaign alone",
          render: () => (
            <StaffPage as="div">
              <SupporterLetterViewExample ask={false} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "LetterStatus",
      file: "app/(staff)/staff/_components/LetterStatus.tsx",
      variants: [
        {
          label:
            "Every status, every skip, one Gmail refused, one with only an automatic reply, one replied to, one answered, and one that bounced though answered",
          render: () => (
            <StaffPage as="div">
              <ul>
                {[
                  "scheduled",
                  "sending",
                  "sent",
                  "queued",
                  "not_sent",
                  "bounced",
                  "spam_complaint",
                  "uncertain",
                  "cancelled",
                ].map((status) => (
                  <li key={status}>
                    <LetterStatus status={status} answered={false} replied={false} />
                  </li>
                ))}
                {(["blocked", "left-office", "no-email"] as const).map((reason) => (
                  <li key={reason}>
                    <LetterStatus status="skipped" skipReason={reason} answered={false} replied={false} />
                  </li>
                ))}
                <li>
                  <LetterStatus status="not_sent" sentBy="gmail" answered={false} replied={false} />
                </li>
                <li>
                  <LetterStatus status="sent" answered={false} replied={false} autoReplied />
                </li>
                <li>
                  <LetterStatus status="sent" answered={false} replied />
                </li>
                <li>
                  <LetterStatus status="sent" answered replied />
                </li>
                <li>
                  <LetterStatus status="bounced" answered replied />
                </li>
              </ul>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "LetterHistory",
      file: "app/(staff)/staff/_components/LetterHistory.tsx",
      variants: [
        {
          label: "Nothing recorded yet",
          render: () => (
            <StaffPage as="div">
              <LetterHistory events={[]} />
            </StaffPage>
          ),
        },
        {
          label: "A supporter's letter copied from Airtable: when it was written, and sent, through Airtable",
          render: () => (
            <StaffPage as="div">
              <LetterHistory
                events={historyOf({
                  ...exampleSupporterLetterDetails,
                  backend: "airtable",
                  createdAt: new Date("2026-09-30T18:00:00Z"),
                  sentAt: new Date("2026-09-30T18:02:00Z"),
                  events: [],
                })}
              />
            </StaffPage>
          ),
        },
        {
          label:
            "Replies: who each was to, and what was done with it; an automatic reply to the bounce address, and the sender's follow-up",
          render: () => (
            <StaffPage as="div">
              <LetterHistory events={historyOf(exampleRepliedLetterDetails)} />
            </StaffPage>
          ),
        },
        {
          label: "Replies recorded before what was done with them was: the forwards logged, one refused",
          render: () => (
            <StaffPage as="div">
              <LetterHistory events={historyOf(exampleOlderRepliedLetterDetails)} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "FindInGmail",
      file: "app/(staff)/staff/_components/FindInGmail.tsx",
      variants: [
        {
          label: "A letter sent from policy@: copies the search for it, then says to paste it where policy@'s mail is",
          render: () => (
            <StaffPage as="div">
              <FindInGmail find={{ mailbox: "policy@pauseai.uk", search: "rfc822msgid:4f1c@pauseai.uk" }} />
            </StaffPage>
          ),
        },
        {
          label: "A supporter's letter sent while policy@ was a Google Group: paste it where its members' mail is",
          render: () => (
            <StaffPage as="div">
              <FindInGmail find={exampleSupporterLetterDetails.gmail} />
            </StaffPage>
          ),
        },
        {
          label: "One copied from Airtable, from a mailbox we don't know",
          render: () => (
            <StaffPage as="div">
              <FindInGmail find={examplePauseaiLetterDetails.gmail} />
            </StaffPage>
          ),
        },
      ],
    },
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
    {
      name: "LetterLink",
      file: "app/(staff)/staff/_components/LetterLink.tsx",
      variants: [
        {
          label: "A letter, by whom it was to",
          render: () => (
            <StaffPage as="div">
              <LetterLink letter={{ id: 17, to: "Bouncy McTestface MP" }} linked />
            </StaffPage>
          ),
        },
        {
          label: "Not linked, for staff without the supporters permission",
          render: () => (
            <StaffPage as="div">
              <LetterLink letter={{ id: 17, to: "Bouncy McTestface MP" }} linked={false} />
            </StaffPage>
          ),
        },
      ],
    },
  ],
};
