import { staffCopy } from "@/lib/content/staff-interface";
import type { BroadcastPageData } from "@/lib/server/broadcast-pages";
import type { SupporterChoices } from "@/lib/server/supporters";
import { supportersSearch, type Params } from "@/lib/staff-search";
import { Muted } from "@/components/ui/Text";
import { broadcastTerms } from "@/lib/broadcasts";
import ChannelIcon from "./ChannelIcon";
import IconText from "./ui/IconText";
import BroadcastView from "./BroadcastView";
import ChannelWriter from "./ChannelWriter";
import type { BroadcastWriterActions } from "./BroadcastWriter";
import { supporterWords } from "./SupporterFilters";
import parts from "./MailingParts.module.css";

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * What everyone a broadcast is to said yes to, from the list's Consent
 * filter: the channel's icon, then the topic as the list's lozenges name it
 * ("Luma texts"). Apart from the other filters, as it's what lets us send it.
 */
export function BroadcastContact({ params }: { params: Params }) {
  const terms = broadcastTerms(params.contact)!;
  const channel = terms.channel === "email" ? "email" : "phone";
  return (
    <IconText icon={<ChannelIcon channel={channel} />}>
      {staffCopy.supporters.subscriptions.topics[channel][terms.topic]}
    </IconText>
  );
}

/** Who else a broadcast is to, as pills that can't be changed here: the list's filters but Consent, which BroadcastContact says. */
export function BroadcastWho({ params, choices }: { params: Params; choices: SupporterChoices }) {
  const others = Object.fromEntries(Object.entries(params).filter(([name]) => name !== "contact"));
  const words = supporterWords(supportersSearch(others), choices);
  if (words.length === 0) return <Muted>{staffCopy.broadcastPages.everyoneWhoSaidYes}</Muted>;
  return (
    <ul className={parts.pills} aria-label={staffCopy.mailingPages.whoLabel}>
      {words.map((word) => (
        <li key={word}>{word}</li>
      ))}
    </ul>
  );
}

/** A broadcast's page, as it stands: a draft, to go on writing; one scheduled, sending or sent, where it's got to. */
export default function BroadcastFor({
  data,
  actions,
}: {
  data: BroadcastPageData;
  actions: BroadcastWriterActions & { stop: FormAction; reschedule: FormAction };
}) {
  if (data.kind === "draft") {
    const who = <BroadcastWho params={data.filter.params} choices={data.choices} />;
    // A new start on a change of channel, as an email's fields and a text's aren't the same.
    return <ChannelWriter key={data.draft.channel} data={data} draft={data.draft} who={who} actions={actions} />;
  }
  const who = <BroadcastWho params={data.written.filter.params} choices={data.choices} />;
  const contact = <BroadcastContact params={data.written.filter.params} />;
  return <BroadcastView data={data} who={who} contact={contact} stop={actions.stop} reschedule={actions.reschedule} />;
}
