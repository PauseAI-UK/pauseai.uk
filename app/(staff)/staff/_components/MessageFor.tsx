import { staffCopy } from "@/lib/content/staff-interface";
import type { MessagePageData } from "@/lib/server/message-pages";
import type { SupporterChoices } from "@/lib/server/supporters";
import { supportersSearch, type Params } from "@/lib/staff-search";
import { Muted } from "@/components/ui/Text";
import { messageTerms } from "@/lib/supporter-messages";
import ChannelIcon from "./ChannelIcon";
import IconText from "./ui/IconText";
import MessageView from "./MessageView";
import ChannelWriter from "./ChannelWriter";
import type { MessageWriterActions } from "./MessageWriter";
import { supporterWords } from "./SupporterFilters";
import parts from "./MailingParts.module.css";

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * What everyone a message is to said yes to, from the list's Consent
 * filter: the channel's icon, then the topic as the list's lozenges name it
 * ("Luma texts"). Apart from the other filters, as it's what lets us send it.
 */
export function MessageContact({ params }: { params: Params }) {
  const terms = messageTerms(params.contact)!;
  const channel = terms.channel === "email" ? "email" : "phone";
  return (
    <IconText icon={<ChannelIcon channel={channel} />}>
      {staffCopy.supporters.subscriptions.topics[channel][terms.topic]}
    </IconText>
  );
}

/** Who else a message is to, as pills that can't be changed here: the list's filters but Consent, which MessageContact says. */
export function MessageWho({ params, choices }: { params: Params; choices: SupporterChoices }) {
  const others = Object.fromEntries(Object.entries(params).filter(([name]) => name !== "contact"));
  const words = supporterWords(supportersSearch(others), choices);
  if (words.length === 0) return <Muted>{staffCopy.messagePages.everyoneWhoSaidYes}</Muted>;
  return (
    <ul className={parts.pills} aria-label={staffCopy.mailingPages.whoLabel}>
      {words.map((word) => (
        <li key={word}>{word}</li>
      ))}
    </ul>
  );
}

/** A message's page, as it stands: a draft, to go on writing; one scheduled, sending or sent, where it's got to. */
export default function MessageFor({
  data,
  actions,
}: {
  data: MessagePageData;
  actions: MessageWriterActions & { stop: FormAction; reschedule: FormAction };
}) {
  if (data.kind === "draft") {
    const who = <MessageWho params={data.filter.params} choices={data.choices} />;
    // A new start on a change of channel, as an email's fields and a text's aren't the same.
    return <ChannelWriter key={data.draft.channel} data={data} draft={data.draft} who={who} actions={actions} />;
  }
  const who = <MessageWho params={data.written.filter.params} choices={data.choices} />;
  const contact = <MessageContact params={data.written.filter.params} />;
  return <MessageView data={data} who={who} contact={contact} stop={actions.stop} reschedule={actions.reschedule} />;
}
