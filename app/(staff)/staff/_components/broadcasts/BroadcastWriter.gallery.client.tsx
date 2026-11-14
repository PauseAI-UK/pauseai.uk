"use client";

// BroadcastWriter's examples, which log what the writer's actions send (BroadcastWriter.gallery.tsx), and the actions BroadcastFor's uses.
import { Muted } from "@/components/ui/Text";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import BroadcastWriter, { type BroadcastWriterActions } from "./BroadcastWriter";
import ChannelWriter from "./ChannelWriter";
import {
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastText,
  exampleTemplates,
  exampleTextSender,
  exampleTextWords,
} from "./BroadcastWriter.examples";

/** A writer's actions, each logged, answering as the server would. */
export function broadcastActions(log: (name: string) => (...args: unknown[]) => void): BroadcastWriterActions {
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
                  rejectedReason: "INVALID_FORMAT",
                },
              };
  const data =
    kind === "off"
      ? { ...exampleBroadcastData, sends: false, textNumber: null }
      : kind === "email" || kind === "blank"
        ? exampleBroadcastData
        : { ...exampleBroadcastData, sender: exampleTextSender };
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
