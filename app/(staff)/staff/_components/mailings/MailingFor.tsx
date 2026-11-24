import type { MailingPageData } from "@/lib/mailings/pages.server";
import { FilterPills } from "./MailingParts";
import MailingView, { type MailingViewActions } from "./MailingView";
import MailingWriter, { type MailingWriterActions } from "./MailingWriter";

/**
 * A mailing's page, as it stands: a draft, to go on writing; one
 * scheduled, sending or sent, where it's got to; one imported from
 * Airtable, the same with what Airtable kept.
 */
export default function MailingFor({
  data,
  actions,
}: {
  data: MailingPageData;
  actions: MailingWriterActions & MailingViewActions;
}) {
  if (data.kind === "imported") {
    return <MailingView mailing={data.mailing} asks={[]} stop={actions.stop} reschedule={actions.reschedule} />;
  }
  const who = <FilterPills data={data} />;
  if (data.kind === "draft") return <MailingWriter data={data} draft={data.draft} who={who} actions={actions} />;
  return (
    <MailingView
      mailing={data.mailing}
      written={data.written}
      who={who}
      asks={data.asks}
      stop={actions.stop}
      reschedule={actions.reschedule}
      copyIt={actions.copy}
    />
  );
}
