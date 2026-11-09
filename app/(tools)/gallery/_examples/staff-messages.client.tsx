"use client";

// The interactive examples of the pages of messages to supporters.
import { useState } from "react";
import { Numbered, DraftTitle } from "@/app/(staff)/staff/_components/DraftWriter";
import { MailingStanding } from "@/app/(staff)/staff/_components/MailingView";
import MessageCopyView from "@/app/(staff)/staff/_components/MessageCopyView";
import MessageFor, { MessageContact, MessageWho } from "@/app/(staff)/staff/_components/MessageFor";
import { ChoosingMessageFrame, MessageSupporters } from "@/app/(staff)/staff/_components/MessageSupporters";
import MessageView from "@/app/(staff)/staff/_components/MessageView";
import MessageConsent from "@/app/(staff)/staff/_components/MessageConsent";
import MessageWriter, { type MessageWriterActions } from "@/app/(staff)/staff/_components/MessageWriter";
import ChannelWriter from "@/app/(staff)/staff/_components/ChannelWriter";
import {
  exampleMessageCopy,
  exampleMessageData,
  exampleMessageEmail,
  exampleMessageSent,
  exampleMessageSummary,
  exampleSupporterChoices,
  exampleMessageText,
  exampleTemplates,
  exampleTextWords,
} from "@/app/(staff)/staff/_components/MessageWriter.examples";
import TemplatePicker from "@/app/(staff)/staff/_components/TemplatePicker";
import { Muted } from "@/components/ui/Text";
import { supportersSearch } from "@/lib/staff-search";
import { Logged } from "../_components/wiring";

function messageActions(log: (name: string) => (...args: unknown[]) => void): MessageWriterActions {
  const logged =
    <T,>(name: string, answer: T) =>
    async (...args: unknown[]) => {
      log(name)(...args);
      return answer;
    };
  return {
    save: logged("saveMessage", { saved: true as const, version: 5 }),
    attach: logged("attachToMessage", undefined),
    detach: logged("detachFromMessage", { saved: true as const, version: 5, attachments: [] }),
    sendTest: logged("sendMessageTestNow", { sent: true as const, id: "example", to: "me@example.com" }),
    schedule: logged("scheduleMessageNow", { scheduled: false as const, problems: [] }),
    deleteDraft: log("deleteMessageDraft"),
    changeConsent: logged("changeMessageConsentNow", true),
    create: logged("newMessageWith", undefined),
    submitTemplate: logged("submitTemplateNow", "submitted" as const),
    withdrawTemplate: logged("withdrawTemplateNow", true),
  };
}

/** The writer: New broadcast before its Consent (ChannelWriter); an email; or a text with no template, one chosen, new words, or rejected. */
export function MessageWriterExample({
  kind,
}: {
  kind: "blank" | "email" | "choose" | "template" | "new" | "rejected" | "off";
}) {
  const draft =
    kind === "email" || kind === "blank"
      ? exampleMessageEmail
      : kind === "choose" || kind === "off"
        ? exampleMessageText
        : kind === "template"
          ? {
              ...exampleMessageText,
              title: exampleTemplates[0].name,
              body: exampleTextWords,
              template: exampleTemplates[0],
            }
          : kind === "new"
            ? { ...exampleMessageText, title: "Hi {first name}", body: exampleTextWords }
            : {
                ...exampleMessageText,
                title: "Hi {first name}",
                body: exampleTextWords,
                template: {
                  ...exampleTemplates[0],
                  status: "rejected" as const,
                  rejectedAt: "2026-11-05T14:02:00Z",
                  rejectedReason: "The text ends with a merge field.",
                },
              };
  const data = kind === "off" ? { ...exampleMessageData, sends: false, textNumber: null } : exampleMessageData;
  return (
    <Logged>
      {(log) =>
        kind === "blank" ? (
          <ChannelWriter
            fresh
            data={data}
            draft={draft}
            who={<Muted>PauseAI London March</Muted>}
            actions={messageActions(log)}
          />
        ) : (
          <MessageWriter
            data={data}
            draft={draft}
            who={<Muted>PauseAI London March</Muted>}
            actions={messageActions(log)}
          />
        )
      }
    </Logged>
  );
}

/** The templates, the one chosen checked and its name logged. */
export function TemplatePickerExample() {
  const [chosen, setChosen] = useState<{ id: number; name: string }>();
  return (
    <>
      <TemplatePicker templates={exampleTemplates} chosen={chosen?.id} onChoose={setChosen} />
      <Muted>{chosen?.name}</Muted>
    </>
  );
}

/** A draft's title, with whether it's saved, and a numbered section's title. */
export function DraftTitleExample() {
  return (
    <>
      <DraftTitle title="Events near you this month" saveState="saved" />
      <h2>
        <Numbered n={1}>To</Numbered>
      </h2>
    </>
  );
}

const nothing = async () => {};
const yes = supportersSearch({ contact: "email:site-forms:yes", near: "LS1" });

/** Message N supporters with a Consent filter answered yes, then without one: dashed. */
export function MessageSupportersExample() {
  return (
    <>
      <MessageSupporters search={yes} total={430} action={nothing} />
    </>
  );
}

/** The list choosing who a draft goes to. */
export function ChoosingMessageFrameExample() {
  return (
    <ChoosingMessageFrame
      choosing={{ id: 3, title: "Events near you", channel: "email", topic: "site-forms", blank: false }}
      search={yes}
      total={430}
      keep={nothing}
    >
      <p>The list.</p>
    </ChoosingMessageFrame>
  );
}

/** A message's page: an email sent, a text sent, or a text scheduled, waiting for approval. */
export function MessageViewExample({ kind }: { kind: "email" | "text" | "scheduled" }) {
  const text = {
    channel: "text" as const,
    sentFrom: "+447700900000",
    body: exampleMessageCopy.body,
  };
  const data =
    kind === "email"
      ? exampleMessageSent
      : kind === "text"
        ? {
            ...exampleMessageSent,
            summary: { ...exampleMessageSummary, channel: "text" as const, read: 240 },
            written: { ...exampleMessageSent.written, ...text },
          }
        : {
            ...exampleMessageSent,
            summary: { ...exampleMessageSummary, channel: "text" as const, state: "scheduled" as const },
            written: {
              ...exampleMessageSent.written,
              ...text,
              state: "scheduled" as const,
              dueAt: "2026-11-07T07:18:00Z",
            },
          };
  return (
    <MessageView
      data={data}
      who={<MessageWho params={exampleMessageData.filter.params} choices={exampleSupporterChoices} />}
      contact={<MessageContact params={data.written.filter.params} />}
      stop={nothing}
      reschedule={nothing}
    />
  );
}

/** A message's page, as it stands: here, sent. */
export function MessageForExample() {
  return (
    <MessageFor
      data={exampleMessageSent}
      actions={{
        ...messageActions(() => () => {}),
        stop: nothing,
        reschedule: nothing,
      }}
    />
  );
}

/** One sending, with Stop sending. */
export function MailingStandingExample() {
  return (
    <MailingStanding
      mailing={exampleMessageSummary}
      written={{ ...exampleMessageSent.written, state: "sending" }}
      stop={nothing}
      reschedule={nothing}
    />
  );
}

/** Message and reply: a text as the conversation, or an email as the thread. */
export function MessageCopyViewExample({ email = false }: { email?: boolean }) {
  const one = email
    ? {
        ...exampleMessageCopy,
        channel: "email" as const,
        subject: "Thank you for marching",
        sentFrom: "hello@pauseai.uk",
        address: "jane@example.com",
        readAt: null,
      }
    : exampleMessageCopy;
  return <MessageCopyView one={one} reply={nothing} />;
}

/** The Consent: neither channel chosen yet, as on New broadcast; texts chosen, their topics to pick; and one with words of its own, so only by its channel. */
export function MessageConsentExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <MessageConsent
            value=""
            channel="email"
            written={false}
            pending={false}
            pick={log("pick")}
            shown=""
            show={log("show")}
          />
          <MessageConsent
            value=""
            channel="email"
            written={false}
            pending={false}
            pick={log("pick")}
            shown="phone"
            show={log("show")}
          />
          <MessageConsent
            value="email:site-forms:yes"
            channel="email"
            written
            pending={false}
            pick={log("pick")}
            shown="email"
            show={log("show")}
          />
        </>
      )}
    </Logged>
  );
}
