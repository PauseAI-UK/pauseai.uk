"use client";

// MailingWriter's examples, which log what its buttons send (MailingWriter.gallery.tsx).
import { FilterPills } from "./MailingParts";
import MailingWriter from "./MailingWriter";
import {
  exampleFreshMailing,
  examplePickedList,
  exampleWriterData,
  exampleWrittenMailing,
} from "./MailingWriter.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** The mailing pages' actions, each logged; saves go through, as a draft's would. */
export function mailingActions(log: (name: string) => (...args: unknown[]) => void) {
  let version = 3;
  const logged =
    <T,>(name: string, answer: T) =>
    async (...args: unknown[]) => {
      log(name)(...args);
      return answer;
    };
  return {
    save: async (...args: unknown[]) => {
      log("saveMailing")(...args);
      return { saved: true as const, version: ++version };
    },
    attach: logged("attachToMailing", {
      saved: true as const,
      version: 4,
      attachments: exampleWrittenMailing.attachments,
    }),
    detach: logged("detachFromMailing", { saved: true as const, version: 4, attachments: [] }),
    sendTest: logged("sendMailingTest", { sent: true as const, id: "example", to: "jo@pauseai.uk" }),
    schedule: logged("scheduleMailingNow", { scheduled: true as const }),
    deleteDraft: logged("deleteMailingDraft", undefined),
    stop: logged("stopMailingNow", undefined),
    reschedule: logged("rescheduleMailingNow", undefined),
  };
}

/** A draft just made, four ticked and nothing written, or Jo's draft of the mailing, with its actions logged. */
export function MailingWriterExample({ draft }: { draft: boolean }) {
  const data = draft ? exampleWriterData : examplePickedList;
  return (
    <Logged>
      {(log) => (
        <MailingWriter
          data={data}
          draft={draft ? exampleWrittenMailing : exampleFreshMailing}
          who={<FilterPills data={data} />}
          actions={mailingActions(log)}
        />
      )}
    </Logged>
  );
}
