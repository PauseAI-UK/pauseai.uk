"use client";

// MailingButtons's examples, which log what they send (MailingButtons.gallery.tsx).
import ButtonRow from "@/components/ui/ButtonRow";
import { CopyMailing, DeleteDraft, ResumeBroadcast, StopMailing } from "./MailingButtons";
import { Logged, type Log } from "@/app/(tools)/gallery/_components/wiring";
import { mailingsCopy } from "./copy";

/** A button's action that logs the form it's sent as `name`, and is done. */
const sends = (log: Log, name: string) => (form: FormData) => {
  log(name)(form);
  return Promise.resolve({ ok: true as const });
};

/** Copy mailing, as at the top right of a mailing's page. */
export function CopyMailingExample({ id }: { id: number }) {
  return (
    <Logged>
      {(log) => (
        <CopyMailing
          id={id}
          label={mailingsCopy.mailingPages.copyMailing}
          action={sends(log, "copyMailingNow")}
          says={{}}
        />
      )}
    </Logged>
  );
}

/** Resume sending, for a broadcast that stopped before it had all gone. */
export function ResumeBroadcastExample({ id }: { id: number }) {
  return <Logged>{(log) => <ResumeBroadcast id={id} action={sends(log, "resumeBroadcastNow")} says={{}} />}</Logged>;
}

/** Delete draft and Stop, for draft `id`, each page's own, so two on a page don't share a box. */
export function MailingButtonsExample({ id }: { id: number }) {
  return (
    <Logged>
      {(log) => (
        <ButtonRow>
          <DeleteDraft id={id} action={sends(log, "deleteMailingDraft")} says={{}} />
          <StopMailing
            id={id}
            label={mailingsCopy.mailingPages.unschedule}
            action={sends(log, "stopMailingNow")}
            says={{}}
          />
        </ButtonRow>
      )}
    </Logged>
  );
}
