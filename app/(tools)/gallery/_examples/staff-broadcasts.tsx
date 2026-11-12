// The staff interface's broadcasts to supporters: from the supporters list, the
// writer, the list of them, each one's page, and one copy as sent.
import { MailingWhen } from "@/app/(staff)/staff/_components/MailingView";
import { BroadcastContact, BroadcastWho } from "@/app/(staff)/staff/_components/BroadcastFor";
import { BroadcastChannelName, BroadcastWaiting, CopyStatus } from "@/app/(staff)/staff/_components/BroadcastView";
import {
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleBroadcastSummary,
  exampleSupporterChoices,
  exampleWhatsAppWords,
} from "@/app/(staff)/staff/_components/BroadcastWriter.examples";
import BroadcastsOverview from "@/app/(staff)/staff/_components/BroadcastsOverview";
import SupporterBroadcasts from "@/app/(staff)/staff/_components/SupporterBroadcasts";
import TextBubble, { ChatBubble, ChatWall, LinkedText, TextWords } from "@/app/(staff)/staff/_components/TextBubble";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { mailingGroups } from "@/lib/mailing-groups";
import type { Group } from "../_components/types";
import {
  ChoosingBroadcastFrameExample,
  DraftFootExample,
  DraftTitleExample,
  MailingStandingExample,
  MessageCopyViewExample,
  AnswerableReplyExample,
  ReplyActionsExample,
  BroadcastForExample,
  BroadcastConsentExample,
  BroadcastSupportersExample,
  BroadcastViewExample,
  BroadcastWriterExample,
} from "./staff-broadcasts.client";

const now = "2026-11-05T12:00:00Z";
const groups = mailingGroups(
  {
    drafts: [
      { ...exampleBroadcastSummary, id: 3, state: "draft" as const, title: "Events near you", to: 412 },
      {
        ...exampleBroadcastSummary,
        id: 5,
        state: "draft" as const,
        channel: "text" as const,
        title: "Rain on Saturday",
        to: 96,
        waiting: true,
        sentFrom: "+447700900000",
        fromName: "PauseAI UK",
      },
    ],
    comingUp: [
      {
        ...exampleBroadcastSummary,
        id: 4,
        state: "scheduled" as const,
        channel: "text" as const,
        dueAt: new Date("2026-11-07T07:18:00Z"),
        title: "March day: where to meet",
        fromName: "PauseAI UK",
        sentFrom: "+447700900000",
      },
      {
        ...exampleBroadcastSummary,
        id: 6,
        state: "scheduled" as const,
        dueAt: new Date("2026-11-08T07:18:00Z"),
        title: "Sunday's stall",
      },
    ],
    sent: [
      exampleBroadcastSummary,
      {
        ...exampleBroadcastSummary,
        id: 7,
        channel: "text" as const,
        read: 240,
        title: "PauseCon: the room has changed",
      },
    ],
  },
  new Date(now),
);

export const staffBroadcasts: Group = {
  id: "staff-broadcasts",
  title: "The staff interface: broadcasts to supporters",
  examples: [
    {
      name: "BroadcastConsent",
      file: "app/(staff)/staff/_components/BroadcastConsent.tsx",
      variants: [
        {
          label: "Said yes to: none chosen yet, then one with words of its own, so only by email",
          render: () => (
            <StaffPage as="div">
              <BroadcastConsentExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastSupporters",
      file: "app/(staff)/staff/_components/BroadcastSupporters.tsx",
      variants: [
        {
          label: "With a Consent filter answered yes; without one there's none",
          render: () => (
            <StaffPage as="div">
              <BroadcastSupportersExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ChoosingBroadcastFrame",
      file: "app/(staff)/staff/_components/BroadcastSupporters.tsx",
      variants: [
        {
          label: "Change who: the dark strip at the top, and the bar at the foot",
          render: () => (
            <StaffPage as="div">
              <ChoosingBroadcastFrameExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ChannelWriter",
      file: "app/(staff)/staff/_components/ChannelWriter.tsx",
      variants: [
        {
          label:
            "New broadcast: email or text, then its Consent, to choose; all after it greyed, an email's or a text's",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="blank" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastWriter",
      file: "app/(staff)/staff/_components/BroadcastWriter.tsx",
      variants: [
        {
          label: "A draft email",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="email" />
            </StaffPage>
          ),
        },
        {
          label: "A draft text: the templates",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="choose" />
            </StaffPage>
          ),
        },
        {
          label: "A template chosen",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="template" />
            </StaffPage>
          ),
        },
        {
          label: "New words",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="new" />
            </StaffPage>
          ),
        },
        {
          label: "Rejected",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="rejected" />
            </StaffPage>
          ),
        },
        {
          label: "Before anything can be sent",
          render: () => (
            <StaffPage as="div">
              <BroadcastWriterExample kind="off" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "DraftTitle",
      file: "app/(staff)/staff/_components/DraftWriter.tsx",
      variants: [
        {
          label: "With whether it's saved",
          render: () => (
            <StaffPage as="div">
              <DraftTitleExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ScheduleButton",
      file: "app/(staff)/staff/_components/DraftWriter.tsx",
      variants: [
        {
          label: "A draft's foot: when it goes, Schedule enabled and refused, and what stops it",
          render: () => (
            <StaffPage as="div">
              <DraftFootExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ProblemList",
      file: "app/(staff)/staff/_components/DraftWriter.tsx",
      variants: [
        {
          label: "With what stops it, and with nothing",
          render: () => (
            <StaffPage as="div">
              <DraftFootExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "DueSection",
      file: "app/(staff)/staff/_components/DraftWriter.tsx",
      variants: [
        {
          label: "No time chosen yet",
          render: () => (
            <StaffPage as="div">
              <DraftFootExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastsOverview",
      file: "app/(staff)/staff/_components/BroadcastsOverview.tsx",
      variants: [
        {
          label: "Emails and texts together",
          render: () => (
            <StaffPage as="div">
              <BroadcastsOverview groups={groups} now={now} />
            </StaffPage>
          ),
        },
        {
          label: "None yet",
          render: () => (
            <StaffPage as="div">
              <BroadcastsOverview groups={[]} now={now} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastChannelName",
      file: "app/(staff)/staff/_components/BroadcastView.tsx",
      variants: [
        {
          label: "Each channel",
          render: () => (
            <>
              <BroadcastChannelName channel="email" />
              <BroadcastChannelName channel="text" />
            </>
          ),
        },
      ],
    },
    {
      name: "CopyStatus",
      file: "app/(staff)/staff/_components/BroadcastView.tsx",
      variants: [
        {
          label:
            "Read, bounced, stopped before it went, asked us to stop after it arrived, replied, a reply to look at, and dropped by PauseAI Global's check",
          render: () => {
            const went = { status: "delivered", skipReason: null, read: false, bounced: false, optedOut: false };
            return (
              <>
                <CopyStatus copyOf={{ ...went, read: true }} />
                <CopyStatus copyOf={{ ...went, status: "failed", bounced: true }} />
                <CopyStatus copyOf={{ ...went, status: "cancelled" }} />
                <CopyStatus copyOf={{ ...went, optedOut: true }} />
                <CopyStatus copyOf={{ ...went, replied: true }} />
                <CopyStatus copyOf={{ ...went, replied: true, toLookAt: true }} />
                <CopyStatus copyOf={{ ...went, status: "skipped", skipReason: "suppressed" }} />
              </>
            );
          },
        },
      ],
    },
    {
      name: "BroadcastWaiting",
      file: "app/(staff)/staff/_components/BroadcastView.tsx",
      variants: [
        {
          label:
            "Scheduled, when it would stop; waiting for CiviCRM, since when and why; and stopped, as it waited too long",
          render: () => (
            <StaffPage as="div">
              <BroadcastWaiting written={{ ...exampleBroadcastEmail, state: "scheduled" }} />
              <BroadcastWaiting
                written={{
                  ...exampleBroadcastEmail,
                  state: "sending",
                  waitingSince: new Date("2026-11-07T07:18:00Z"),
                  waitReason: "civicrm",
                }}
              />
              <BroadcastWaiting
                written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "pull" }}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastView",
      file: "app/(staff)/staff/_components/BroadcastView.tsx",
      variants: [
        {
          label: "An email sent",
          render: () => (
            <StaffPage as="div">
              <BroadcastViewExample kind="email" />
            </StaffPage>
          ),
        },
        {
          label: "A text sent",
          render: () => (
            <StaffPage as="div">
              <BroadcastViewExample kind="text" />
            </StaffPage>
          ),
        },
        {
          label: "A text scheduled",
          render: () => (
            <StaffPage as="div">
              <BroadcastViewExample kind="scheduled" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastFor",
      file: "app/(staff)/staff/_components/BroadcastFor.tsx",
      variants: [
        {
          label: "As it stands: here, sent",
          render: () => (
            <StaffPage as="div">
              <BroadcastForExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastContact",
      file: "app/(staff)/staff/_components/BroadcastFor.tsx",
      variants: [
        {
          label: "What they all said yes to: by email, then by text",
          render: () => (
            <StaffPage as="div">
              <p>
                <BroadcastContact params={{ contact: "email:events:yes" }} />
              </p>
              <p>
                <BroadcastContact params={{ contact: "text:events:yes" }} />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "BroadcastWho",
      file: "app/(staff)/staff/_components/BroadcastFor.tsx",
      variants: [
        {
          label: "The filters but Consent, as pills",
          render: () => (
            <StaffPage as="div">
              <BroadcastWho params={exampleBroadcastData.filter.params} choices={exampleSupporterChoices} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingStanding",
      file: "app/(staff)/staff/_components/MailingView.tsx",
      variants: [
        {
          label: "Sending, with Stop sending",
          render: () => (
            <StaffPage as="div">
              <MailingStandingExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingWhen",
      file: "app/(staff)/staff/_components/MailingView.tsx",
      variants: [
        {
          label: "When it went",
          render: () => (
            <dl>
              <MailingWhen mailing={exampleBroadcastSummary} written={exampleBroadcastSent.written} />
            </dl>
          ),
        },
      ],
    },
    {
      name: "MessageCopyView",
      file: "app/(staff)/staff/_components/MessageCopyView.tsx",
      variants: [
        {
          label: "A text, as the conversation",
          render: () => (
            <StaffPage as="div">
              <MessageCopyViewExample />
            </StaffPage>
          ),
        },
        {
          label: "An email, as the thread",
          render: () => (
            <StaffPage as="div">
              <MessageCopyViewExample email />
            </StaffPage>
          ),
        },
        {
          label: "An email's replies: one to look at, one dealt with, and an automatic one",
          render: () => (
            <StaffPage as="div">
              <MessageCopyViewExample email replies />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ReplyActions",
      file: "app/(staff)/staff/_components/ReplyActions.tsx",
      variants: [
        {
          label: "What a reply is: an opt-out of what the email went under, or of all bulk email; or nothing to do",
          render: () => (
            <StaffPage as="div">
              <ReplyActionsExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AnswerableReply",
      file: "app/(staff)/staff/_components/AnswerableReply.tsx",
      variants: [
        {
          label: "A reply with its answer folded to one line under it, and opened, being written as it will be sent",
          render: () => (
            <StaffPage as="div">
              <AnswerableReplyExample />
              <AnswerableReplyExample opened />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SupporterBroadcasts",
      file: "app/(staff)/staff/_components/SupporterBroadcasts.tsx",
      variants: [
        {
          label: "Those they were sent, one with a reply to look at",
          render: () => (
            <StaffPage as="div">
              <SupporterBroadcasts
                broadcasts={[
                  {
                    copyId: 21,
                    messageId: 5,
                    title: "March day: where to meet",
                    channel: "text",
                    topics: ["events"],
                    status: "delivered",
                    skipReason: null,
                    sentAt: new Date("2026-11-07T07:18:00Z"),
                    read: true,
                    bounced: false,
                    optedOut: false,
                    replied: false,
                    toLookAt: false,
                  },
                  {
                    copyId: 23,
                    messageId: 7,
                    title: "Thank you for marching",
                    channel: "email",
                    topics: ["newsletter"],
                    status: "delivered",
                    skipReason: null,
                    sentAt: new Date("2026-11-06T09:18:00Z"),
                    read: true,
                    bounced: false,
                    optedOut: false,
                    replied: true,
                    toLookAt: true,
                  },
                  {
                    copyId: 22,
                    messageId: 6,
                    title: "",
                    channel: "email",
                    topics: ["newsletter"],
                    status: "failed",
                    skipReason: null,
                    sentAt: null,
                    read: false,
                    bounced: false,
                    optedOut: false,
                    replied: false,
                    toLookAt: false,
                  },
                ]}
              />
              <SupporterBroadcasts broadcasts={[]} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "TextBubble",
      file: "app/(staff)/staff/_components/TextBubble.tsx",
      variants: [
        {
          label: "A text with its Stop button",
          render: () => <TextBubble from="PauseAI UK" words={exampleWhatsAppWords} time="07:18" />,
        },
      ],
    },
    {
      name: "TextWords",
      file: "app/(staff)/staff/_components/TextBubble.tsx",
      variants: [
        {
          label: "A text's words as WhatsApp shows them, in a bubble of our own",
          render: () => (
            <ChatWall>
              <ChatBubble who="PauseAI UK" when="07:18" ours>
                <TextWords words={exampleWhatsAppWords} />
              </ChatBubble>
            </ChatWall>
          ),
        },
      ],
    },
    {
      name: "LinkedText",
      file: "app/(staff)/staff/_components/TextBubble.tsx",
      variants: [
        {
          label: "A text's words, each web address a link",
          render: () => <LinkedText text="Sign up at https://pauseai.uk/join, or www.example.org." />,
        },
      ],
    },
    {
      name: "ChatWall",
      file: "app/(staff)/staff/_components/TextBubble.tsx",
      variants: [
        {
          label: "A conversation",
          render: () => (
            <ChatWall>
              <ChatBubble who="Jane" when="07:52">
                Can I bring my dog?
              </ChatBubble>
              <ChatBubble who="Jo" when="08:10" ours>
                Yes.
              </ChatBubble>
            </ChatWall>
          ),
        },
      ],
    },
    {
      name: "ChatBubble",
      file: "app/(staff)/staff/_components/TextBubble.tsx",
      variants: [
        {
          label: "Theirs",
          render: () => (
            <ChatBubble who="Jane" when="07:52">
              Can I bring my dog?
            </ChatBubble>
          ),
        },
      ],
    },
  ],
};
