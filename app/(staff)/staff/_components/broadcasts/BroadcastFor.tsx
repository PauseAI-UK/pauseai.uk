import type { BroadcastPageData } from "@/lib/broadcasts/pages.server";
import type { SupporterChoices } from "@/lib/supporters/records.server";
import { type Params } from "@/lib/list-params";
import { Muted } from "@/components/ui/Text";
import { broadcastTerms } from "@/lib/broadcasts/broadcasts";
import BroadcastView from "./BroadcastView";
import ChannelWriter from "./ChannelWriter";
import type { BroadcastWriterActions } from "./BroadcastWriter";
import { othersThanConsent } from "../supporters/SupporterFilters";
import Pills from "../ui/Pills";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * What everyone a broadcast is to said yes to, from the list's Consent
 * filter, in few words: its topics, then its channel. Apart from the other
 * filters, as it's what lets us send it.
 */
export function BroadcastContact({ params }: { params: Params }) {
  const terms = broadcastTerms(params.contact)!;
  return <>{broadcastsCopy.broadcastPages.saidYesTo(terms.topics, terms.channel)}</>;
}

/** Who else a broadcast is to, as pills that can't be changed here: the list's filters but Consent, which BroadcastContact says. */
export function BroadcastWho({ params, choices }: { params: Params; choices: SupporterChoices }) {
  const pills = othersThanConsent(params, choices);
  if (pills.length === 0) return <Muted>{broadcastsCopy.broadcastPages.everyoneWhoSaidYes}</Muted>;
  return <Pills pills={pills} label={mailingsCopy.mailingPages.whoLabel} />;
}

/** A broadcast's page, as it stands: a draft, to go on writing; one scheduled, sending or sent, where it's got to. */
export default function BroadcastFor({
  data,
  actions,
}: {
  data: BroadcastPageData;
  actions: BroadcastWriterActions & { stop: FormAction; reschedule: FormAction; resume: FormAction; copy?: FormAction };
}) {
  if (data.kind === "draft") {
    const who = <BroadcastWho params={data.filter.params} choices={data.choices} />;
    // A new start on a change of channel, as an email's fields and a text's aren't the same.
    return <ChannelWriter key={data.draft.channel} data={data} draft={data.draft} who={who} actions={actions} />;
  }
  const params = data.written.filter.params;
  const who = <BroadcastWho params={params} choices={data.choices} />;
  const contact = <BroadcastContact params={params} />;
  return (
    <BroadcastView
      data={data}
      who={who}
      contact={contact}
      stop={actions.stop}
      reschedule={actions.reschedule}
      resume={actions.resume}
      copyIt={actions.copy}
    />
  );
}
