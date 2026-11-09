// The staff interface's messages to supporters: from the supporters list, the
// writer, the list of them, each one's page, and one copy with its replies.
import { MailingWhen } from "@/app/(staff)/staff/_components/MailingView";
import { MessageContact, MessageWho } from "@/app/(staff)/staff/_components/MessageFor";
import { MessageChannelName } from "@/app/(staff)/staff/_components/MessageView";
import {
  exampleMessageData,
  exampleMessageSent,
  exampleMessageSummary,
  exampleSupporterChoices,
  exampleWhatsAppWords,
} from "@/app/(staff)/staff/_components/MessageWriter.examples";
import MessagesOverview from "@/app/(staff)/staff/_components/MessagesOverview";
import SupporterMessages from "@/app/(staff)/staff/_components/SupporterMessages";
import TextBubble, { ChatBubble, ChatWall, LinkedText } from "@/app/(staff)/staff/_components/TextBubble";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { mailingGroups } from "@/lib/mailing-groups";
import type { Group } from "../_components/types";
import {
  ChoosingMessageFrameExample,
  DraftTitleExample,
  MailingStandingExample,
  MessageCopyViewExample,
  MessageForExample,
  MessageConsentExample,
  MessageSupportersExample,
  MessageViewExample,
  MessageWriterExample,
  TemplatePickerExample,
} from "./staff-messages.client";

const now = "2026-11-05T12:00:00Z";
const groups = mailingGroups(
  {
    drafts: [{ ...exampleMessageSummary, id: 3, state: "draft" as const, title: "Events near you", to: 412 }],
    comingUp: [
      {
        ...exampleMessageSummary,
        id: 4,
        state: "scheduled" as const,
        channel: "text" as const,
        waiting: true,
        dueAt: "2026-11-07T07:18:00Z",
        title: "March day: where to meet",
        fromName: "PauseAI UK",
        sentFrom: "+447700900000",
      },
      {
        ...exampleMessageSummary,
        id: 6,
        state: "scheduled" as const,
        dueAt: "2026-11-08T07:18:00Z",
        title: "Sunday's stall",
      },
    ],
    sent: [
      exampleMessageSummary,
      { ...exampleMessageSummary, id: 7, channel: "text" as const, read: 240, title: "PauseCon: the room has changed" },
    ],
  },
  new Date(now),
);

export const staffMessages: Group = {
  id: "staff-messages",
  title: "The staff interface: messages to supporters",
  examples: [
    {
      name: "MessageConsent",
      file: "app/(staff)/staff/_components/MessageConsent.tsx",
      variants: [
        {
          label: "Said yes to: none chosen yet, then one with words of its own, so only by email",
          render: () => (
            <StaffPage as="div">
              <MessageConsentExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageSupporters",
      file: "app/(staff)/staff/_components/MessageSupporters.tsx",
      variants: [
        {
          label: "With a Consent filter answered yes; without one there's none",
          render: () => (
            <StaffPage as="div">
              <MessageSupportersExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ChoosingMessageFrame",
      file: "app/(staff)/staff/_components/MessageSupporters.tsx",
      variants: [
        {
          label: "Change who: the dark strip at the top, and the bar at the foot",
          render: () => (
            <StaffPage as="div">
              <ChoosingMessageFrameExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "NewMessageWriter",
      file: "app/(staff)/staff/_components/NewMessageWriter.tsx",
      variants: [
        {
          label:
            "New broadcast: email or text, then its Consent, to choose; all after it greyed, an email's or a text's",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="blank" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageWriter",
      file: "app/(staff)/staff/_components/MessageWriter.tsx",
      variants: [
        {
          label: "A draft email",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="email" />
            </StaffPage>
          ),
        },
        {
          label: "A draft text: the templates",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="choose" />
            </StaffPage>
          ),
        },
        {
          label: "A template chosen",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="template" />
            </StaffPage>
          ),
        },
        {
          label: "New words",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="new" />
            </StaffPage>
          ),
        },
        {
          label: "Rejected",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="rejected" />
            </StaffPage>
          ),
        },
        {
          label: "Before anything can be sent",
          render: () => (
            <StaffPage as="div">
              <MessageWriterExample kind="off" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "TemplatePicker",
      file: "app/(staff)/staff/_components/TemplatePicker.tsx",
      variants: [
        {
          label: "Five, with a search and Show all",
          render: () => (
            <StaffPage as="div">
              <TemplatePickerExample />
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
      name: "Numbered",
      file: "app/(staff)/staff/_components/DraftWriter.tsx",
      variants: [
        {
          label: "A section's title, as in the draft above",
          render: () => (
            <StaffPage as="div">
              <DraftTitleExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessagesOverview",
      file: "app/(staff)/staff/_components/MessagesOverview.tsx",
      variants: [
        {
          label: "Emails and texts together",
          render: () => (
            <StaffPage as="div">
              <MessagesOverview groups={groups} now={now} />
            </StaffPage>
          ),
        },
        {
          label: "None yet",
          render: () => (
            <StaffPage as="div">
              <MessagesOverview groups={[]} now={now} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageChannelName",
      file: "app/(staff)/staff/_components/MessageView.tsx",
      variants: [
        {
          label: "Each channel",
          render: () => (
            <>
              <MessageChannelName channel="email" />
              <MessageChannelName channel="text" />
            </>
          ),
        },
      ],
    },
    {
      name: "MessageView",
      file: "app/(staff)/staff/_components/MessageView.tsx",
      variants: [
        {
          label: "An email sent",
          render: () => (
            <StaffPage as="div">
              <MessageViewExample kind="email" />
            </StaffPage>
          ),
        },
        {
          label: "A text sent",
          render: () => (
            <StaffPage as="div">
              <MessageViewExample kind="text" />
            </StaffPage>
          ),
        },
        {
          label: "A text scheduled, waiting for WhatsApp's approval",
          render: () => (
            <StaffPage as="div">
              <MessageViewExample kind="waiting" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageFor",
      file: "app/(staff)/staff/_components/MessageFor.tsx",
      variants: [
        {
          label: "As it stands: here, sent",
          render: () => (
            <StaffPage as="div">
              <MessageForExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageContact",
      file: "app/(staff)/staff/_components/MessageFor.tsx",
      variants: [
        {
          label: "What they all said yes to: by email, then by text",
          render: () => (
            <StaffPage as="div">
              <p>
                <MessageContact params={{ contact: "email:luma-calendar:yes" }} />
              </p>
              <p>
                <MessageContact params={{ contact: "phone:march-day:yes" }} />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MessageWho",
      file: "app/(staff)/staff/_components/MessageFor.tsx",
      variants: [
        {
          label: "The filters but Consent, as pills",
          render: () => (
            <StaffPage as="div">
              <MessageWho params={exampleMessageData.filter.params} choices={exampleSupporterChoices} />
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
              <MailingWhen mailing={exampleMessageSummary} written={exampleMessageSent.written} />
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
      ],
    },
    {
      name: "SupporterMessages",
      file: "app/(staff)/staff/_components/SupporterMessages.tsx",
      variants: [
        {
          label: "Those they were sent, with their replies",
          render: () => (
            <StaffPage as="div">
              <SupporterMessages
                messages={[
                  {
                    copyId: 21,
                    messageId: 5,
                    title: "March day: where to meet",
                    channel: "text",
                    status: "delivered",
                    skipReason: null,
                    sentAt: "2026-11-07T07:18:00Z",
                    read: true,
                    replies: [{ at: "2026-11-07T07:52:00Z", body: "Great, thanks." }],
                  },
                  {
                    copyId: 22,
                    messageId: 6,
                    title: "",
                    channel: "email",
                    status: "failed",
                    skipReason: null,
                    sentAt: null,
                    read: false,
                    replies: [],
                  },
                ]}
              />
              <SupporterMessages messages={[]} />
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
