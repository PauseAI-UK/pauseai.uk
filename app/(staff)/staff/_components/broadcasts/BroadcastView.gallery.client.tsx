"use client";

// BroadcastView's example of a broadcast's page (BroadcastView.gallery.tsx).
import BroadcastView from "./BroadcastView";
import { BroadcastContact, BroadcastWho } from "./BroadcastFor";
import {
  exampleBroadcastData,
  exampleBroadcastSent,
  exampleBroadcastSummary,
  exampleMessageCopy,
  exampleSupporterChoices,
} from "./BroadcastWriter.examples";

/** A Server Action that does nothing, which BroadcastFor's and BroadcastSupporters' examples use too. */
export const nothing = async () => {};

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
