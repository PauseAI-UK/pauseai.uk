"use client";

// The interactive examples of the pages of broadcasts to supporters.
import { DraftTitle, DueSection, ProblemList, ScheduleButton } from "@/app/(staff)/staff/_components/DraftWriter";
import Numbered from "@/app/(staff)/staff/_components/ui/Numbered";
import { MailingStanding } from "@/app/(staff)/staff/_components/MailingView";
import AnswerableReply, { type AnswerAction } from "@/app/(staff)/staff/_components/AnswerableReply";
import ThreadEmail from "@/app/(staff)/staff/_components/ThreadEmail";
import ReplyActions, { ReplyButton } from "@/app/(staff)/staff/_components/ReplyActions";
import MessageCopyView from "@/app/(staff)/staff/_components/MessageCopyView";
import BroadcastFor, { BroadcastContact, BroadcastWho } from "@/app/(staff)/staff/_components/BroadcastFor";
import { ChoosingBroadcastFrame, BroadcastSupporters } from "@/app/(staff)/staff/_components/BroadcastSupporters";
import BroadcastView from "@/app/(staff)/staff/_components/BroadcastView";
import BroadcastConsent from "@/app/(staff)/staff/_components/BroadcastConsent";
import BroadcastWriter, { type BroadcastWriterActions } from "@/app/(staff)/staff/_components/BroadcastWriter";
import ChannelWriter from "@/app/(staff)/staff/_components/ChannelWriter";
import {
  exampleBroadcastAnswers,
  exampleBroadcastReplies,
  exampleMessageCopy,
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleBroadcastSummary,
  exampleSupporterChoices,
  exampleBroadcastText,
  exampleTemplates,
  exampleTextWords,
} from "@/app/(staff)/staff/_components/BroadcastWriter.examples";
import { Muted } from "@/components/ui/Text";
import { supportersSearch } from "@/lib/staff-search";
import { Logged } from "../_components/wiring";

function broadcastActions(log: (name: string) => (...args: unknown[]) => void): BroadcastWriterActions {
  const logged =
    <T,>(name: string, answer: T) =>
    async (...args: unknown[]) => {
      log(name)(...args);
      return answer;
    };
  return {
    save: logged("saveBroadcast", { saved: true as const, version: 5 }),
    attach: logged("attachToBroadcast", undefined),
    detach: logged("detachFromBroadcast", { saved: true as const, version: 5, attachments: [] }),
    sendTest: logged("sendBroadcastTestNow", { sent: true as const, id: "example", to: "me@example.com" }),
    schedule: logged("scheduleBroadcastNow", { scheduled: false as const, problems: [] }),
    deleteDraft: log("deleteBroadcastDraft"),
    changeConsent: logged("changeBroadcastConsentNow", true),
    create: logged("newBroadcastWith", undefined),
    submitTemplate: logged("submitTemplateNow", "submitted" as const),
    withdrawTemplate: logged("withdrawTemplateNow", true),
  };
}

/** The writer: New broadcast before its Consent (ChannelWriter); an email; or a text with no template, one chosen, new words, or rejected. */
export function BroadcastWriterExample({
  kind,
}: {
  kind: "blank" | "email" | "choose" | "template" | "new" | "rejected" | "off";
}) {
  const draft =
    kind === "email" || kind === "blank"
      ? exampleBroadcastEmail
      : kind === "choose" || kind === "off"
        ? exampleBroadcastText
        : kind === "template"
          ? {
              ...exampleBroadcastText,
              title: exampleTemplates[0].name,
              body: exampleTextWords,
              template: exampleTemplates[0],
            }
          : kind === "new"
            ? { ...exampleBroadcastText, title: "Hi {first name}", body: exampleTextWords }
            : {
                ...exampleBroadcastText,
                title: "Hi {first name}",
                body: exampleTextWords,
                template: {
                  ...exampleTemplates[0],
                  status: "rejected" as const,
                  rejectedAt: new Date("2026-11-05T14:02:00Z"),
                  rejectedReason: "The text ends with a merge field.",
                },
              };
  const data = kind === "off" ? { ...exampleBroadcastData, sends: false, textNumber: null } : exampleBroadcastData;
  return (
    <Logged>
      {(log) =>
        kind === "blank" ? (
          <ChannelWriter
            fresh
            data={data}
            draft={draft}
            who={<Muted>PauseAI London March</Muted>}
            actions={broadcastActions(log)}
          />
        ) : (
          <BroadcastWriter
            data={data}
            draft={draft}
            who={<Muted>PauseAI London March</Muted>}
            actions={broadcastActions(log)}
          />
        )
      }
    </Logged>
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

/** Scheduling, refused, as the server says when something stops it. */
const refused = async () => ({ scheduled: false });

/** A draft's foot: Schedule, enabled and refused, what stops it, and when it goes, its choice logged. */
export function DraftFootExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <DueSection dueAt={null} onChange={log("dueAt")} />
          <ScheduleButton label="Schedule 412 emails" disabled={false} saveNow={nothing} schedule={refused} />
          <ScheduleButton label="Schedule 412 emails" disabled saveNow={nothing} schedule={refused} />
          <ProblemList problems={["Fill in the subject.", "Choose what time it will be sent."]} />
          <ProblemList problems={[]} />
        </>
      )}
    </Logged>
  );
}

const nothing = async () => {};
const yes = supportersSearch({ contact: "email:newsletter:yes", near: "LS1" });

/** Broadcast to N supporters, with a Consent filter answered yes. */
export function BroadcastSupportersExample() {
  return (
    <>
      <BroadcastSupporters search={yes} total={430} action={nothing} />
    </>
  );
}

/** The list choosing who a draft goes to. */
export function ChoosingBroadcastFrameExample() {
  return (
    <ChoosingBroadcastFrame
      choosing={{ id: 3, title: "Events near you", channel: "email", topics: ["newsletter"], blank: false }}
      search={yes}
      total={430}
      keep={nothing}
    >
      <p>The list.</p>
    </ChoosingBroadcastFrame>
  );
}

/** A broadcast's page: an email sent, a text sent, or a text scheduled, waiting for approval. */
export function BroadcastViewExample({ kind }: { kind: "email" | "text" | "scheduled" }) {
  const text = {
    channel: "text" as const,
    sentFrom: "+447700900000",
    body: exampleMessageCopy.body,
  };
  const data =
    kind === "email"
      ? exampleBroadcastSent
      : kind === "text"
        ? {
            ...exampleBroadcastSent,
            summary: { ...exampleBroadcastSummary, channel: "text" as const, read: 240 },
            written: { ...exampleBroadcastSent.written, ...text },
          }
        : {
            ...exampleBroadcastSent,
            summary: { ...exampleBroadcastSummary, channel: "text" as const, state: "scheduled" as const },
            written: {
              ...exampleBroadcastSent.written,
              ...text,
              state: "scheduled" as const,
              dueAt: new Date("2026-11-07T07:18:00Z"),
            },
          };
  return (
    <BroadcastView
      data={data}
      who={<BroadcastWho params={exampleBroadcastData.filter.params} choices={exampleSupporterChoices} />}
      contact={<BroadcastContact params={data.written.filter.params} />}
      stop={nothing}
      reschedule={nothing}
      resume={nothing}
    />
  );
}

/** A broadcast's page, as it stands: here, sent. */
export function BroadcastForExample() {
  return (
    <BroadcastFor
      data={exampleBroadcastSent}
      actions={{
        ...broadcastActions(() => () => {}),
        stop: nothing,
        reschedule: nothing,
        resume: nothing,
      }}
    />
  );
}

/** One sending, with Stop sending. */
export function MailingStandingExample() {
  return (
    <MailingStanding
      mailing={exampleBroadcastSummary}
      written={{ ...exampleBroadcastSent.written, state: "sending" }}
      stop={nothing}
      reschedule={nothing}
    />
  );
}

/** Thread: a text as the conversation, or an email as the thread, with `replies` under it: one to look at, one dealt with, one answered, and an automatic one. */
export function MessageCopyViewExample({ email = false, replies = false }: { email?: boolean; replies?: boolean }) {
  const one = email
    ? {
        ...exampleMessageCopy,
        channel: "email" as const,
        subject: "Thank you for marching",
        sentFrom: "hello@pauseai.uk",
        address: "jane@example.com",
        readAt: null,
        topics: ["newsletter" as const],
        replies: replies ? exampleBroadcastReplies : [],
        answers: replies ? exampleBroadcastAnswers : [],
      }
    : exampleMessageCopy;
  return <Logged>{(log) => <MessageCopyView one={one} actions={{ deal: log("deal"), answer: sent(log) }} />}</Logged>;
}

/** What to record a reply as, under it. */
export function ReplyActionsExample({ write = false }: { write?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <ReplyActions
          replyId={1}
          topics={["newsletter", "events"]}
          deal={log("deal")}
          write={write ? () => log("write")() : undefined}
        />
      )}
    </Logged>
  );
}

/** Reply, logging its press. */
export function ReplyButtonExample() {
  return <Logged>{(log) => <ReplyButton write={() => log("write")()} />}</Logged>;
}

/** An answer that logs what it'd send, and goes. */
const sent =
  (log: (name: string) => (...args: unknown[]) => void): AnswerAction =>
  async (...args) => {
    log("answer")(...args);
    return { sent: true };
  };

/** A reply in the thread with its Reply button, and its answer opened, being written. */
export function AnswerableReplyExample({ opened = false }: { opened?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <AnswerableReply
          replyId={1}
          from="PauseAI UK <hello@pauseai.uk>"
          to="jane@example.com"
          subject="Re: Thank you for marching"
          answer={sent(log)}
          opened={opened}
        >
          {(write) => (
            <ThreadEmail
              from="jane@example.com"
              to="PauseAI UK <hello@pauseai.uk>"
              at={new Date("2026-11-07T09:30:00Z")}
              subject="Re: Thank you for marching"
            >
              <p>Could you take me off this list please?</p>
              {write && <ReplyButton write={write} />}
            </ThreadEmail>
          )}
        </AnswerableReply>
      )}
    </Logged>
  );
}

/** The Consent: neither channel chosen yet, as on New broadcast; texts chosen, their topics to pick; and one with words of its own, so only by its channel. */
export function BroadcastConsentExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <BroadcastConsent
            value=""
            channel="email"
            written={false}
            pending={false}
            pick={log("pick")}
            shown=""
            show={log("show")}
          />
          <BroadcastConsent
            value=""
            channel="email"
            written={false}
            pending={false}
            pick={log("pick")}
            shown="phone"
            show={log("show")}
          />
          <BroadcastConsent
            value="email:newsletter:yes"
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
