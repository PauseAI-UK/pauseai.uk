"use client";

// MailingButtons's examples, which log what they send (MailingButtons.gallery.tsx).
import ButtonRow from "@/components/ui/ButtonRow";
import { CopyMailing, DeleteDraft, ResumeBroadcast, StopMailing } from "./MailingButtons";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { mailingsCopy } from "./copy";

/** Copy mailing, as at the top right of a mailing's page. */
export function CopyMailingExample({ id }: { id: number }) {
  return (
    <Logged>
      {(log) => <CopyMailing id={id} label={mailingsCopy.mailingPages.copyMailing} action={log("copyMailingNow")} />}
    </Logged>
  );
}

/** Resume sending, for a broadcast that stopped before it had all gone. */
export function ResumeBroadcastExample({ id }: { id: number }) {
  return <Logged>{(log) => <ResumeBroadcast id={id} action={log("resumeBroadcastNow")} />}</Logged>;
}

/** Delete draft and Stop, for draft `id`, each page's own, so two on a page don't share a box. */
export function MailingButtonsExample({ id }: { id: number }) {
  return (
    <Logged>
      {(log) => (
        <ButtonRow>
          <DeleteDraft id={id} action={log("deleteMailingDraft")} />
          <StopMailing id={id} label={mailingsCopy.mailingPages.unschedule} action={log("stopMailingNow")} />
        </ButtonRow>
      )}
    </Logged>
  );
}
