"use client";

// MailingView's examples, which log what its buttons send (MailingView.gallery.tsx).
import { FilterPills } from "./MailingParts";
import MailingView, { MailingStanding } from "./MailingView";
import { exampleWriterData, exampleWrittenMailing } from "./MailingWriter.examples";
import { exampleMailing, exampleMailings } from "./MailingsTable.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { exampleAsks } from "../asks/AsksList.examples";
import { exampleBroadcastSent, exampleBroadcastSummary } from "../BroadcastWriter.examples";

/** A Server Action that does nothing. */
const nothing = async () => {};

/** A mailing's page in each state but draft, or one imported from Airtable, with none. */
export function MailingViewExample({ state }: { state: "scheduled" | "sending" | "sent" | "imported" }) {
  return (
    <Logged>
      {(log) => (
        <MailingView
          mailing={state === "imported" ? exampleMailing : { ...exampleMailing, ...exampleMailings[0] }}
          written={state === "imported" ? undefined : { ...exampleWrittenMailing, state }}
          who={<FilterPills data={exampleWriterData} />}
          asks={exampleAsks}
          stop={log("stopMailingNow")}
          reschedule={log("rescheduleMailingNow")}
        />
      )}
    </Logged>
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
