"use client";

// MailingView's examples, which log what its buttons send (MailingView.gallery.tsx).
import { FilterPills } from "./MailingParts";
import MailingView, { MailingStanding } from "./MailingView";
import { exampleWriterData, exampleWrittenMailing } from "./MailingWriter.examples";
import { exampleMailing, exampleMailings, exampleSending } from "./MailingsTable.examples";
import { Logged, type Log } from "@/app/(tools)/gallery/_components/wiring";
import { exampleAsks } from "../asks/AsksList.examples";

/** A Server Action that does nothing, and is done. */
const nothing = () => Promise.resolve({ ok: true as const });

/** A form's action that logs the form it's sent as `name`, and is done. */
const sends = (log: Log, name: string) => (form: FormData) => {
  log(name)(form);
  return nothing();
};

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
          stop={sends(log, "stopMailingNow")}
          reschedule={sends(log, "rescheduleMailingNow")}
        />
      )}
    </Logged>
  );
}

/** One to every MP, sending, with Stop sending. */
export function MailingStandingExample() {
  return (
    <MailingStanding
      mailing={exampleSending}
      written={{ ...exampleWrittenMailing, state: "sending" }}
      stop={{ action: nothing, says: {} }}
    />
  );
}
