"use client";

import { Segmented } from "@/components/ui/Controls";
import { FieldSet } from "@/components/ui/Field";
import { choiceTerms, consentChoice } from "@/lib/broadcasts/broadcasts";
import { LIST_TOPICS, listOf, listsBy, type Channel, type List } from "@/lib/supporters/contact-permissions";
import ChannelIcon from "@/components/ui/ChannelIcon";
import { useState } from "react";
import own from "./Broadcasts.module.css";
import { supportersCopy } from "../supporters/copy";
import { ListsHelp } from "../supporters/PermissionTiles";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

const CHANNELS: Channel[] = ["email", "phone"];

/**
 * The Consent a broadcast goes under, which says whether it's an email or a
 * text and who it goes to: first email or text, then one of the lists by
 * it, as the Consent filter names and orders them; a text goes to a list's
 * yeses by text. `value` is the one chosen, as consentChoice writes it, or
 * none yet. Once it has words of its own (`written`), the other channel
 * can't be chosen, so none are lost. `shown` is the channel whose lists
 * show, and `show` shows another's; a list picked on a channel not the
 * broadcast's starts it on that one.
 */
export default function BroadcastConsent({
  value,
  channel,
  written,
  pending,
  pick,
  shown,
  show,
  className,
}: {
  value: string;
  channel: Channel;
  written: boolean;
  pending: boolean;
  pick: (value: string) => void;
  shown: Channel | "";
  show: (channel: Channel) => void;
  className?: string;
}) {
  const terms = choiceTerms(value);
  const way = shown === "email" ? "email" : "text";
  // The list on: the broadcast's, while its own channel shows.
  const on = terms && shown === channel ? listOf(terms.topics) : undefined;
  const lists = listsBy(way).map((list) => ({ value: list, label: supportersCopy.supporters.filters.lists[list] }));
  // The list last pressed: while its change is on its way, it shows a spinner.
  const [pressed, setPressed] = useState<List>();
  const choose = (list: List) => {
    setPressed(list);
    pick(consentChoice({ channel: way, topics: LIST_TOPICS[list] }));
  };
  return (
    <div className={className}>
      <FieldSet label={copy.consentChannel}>
        <Segmented<Channel>
          label={copy.consentChannel}
          options={CHANNELS.map((one) => ({
            value: one,
            label: copy.channels[one === "email" ? "email" : "text"],
            icon: <ChannelIcon channel={one === "email" ? "email" : "text"} />,
            disabled: written && one !== channel,
          }))}
          // None chosen yet matches no option, so none is checked.
          value={shown as Channel}
          onChange={show}
          busy={pending}
        />
      </FieldSet>
      {shown && (
        <FieldSet label={copy.facts.saidYes}>
          <div className={own.topics}>
            <Segmented<List>
              label={copy.facts.saidYes}
              options={lists}
              // None chosen yet, or a broadcast's from before the lists, matches no option, so none is checked.
              value={on as List}
              onChange={(list) => list !== on && choose(list)}
              busy={pending}
              waiting={pressed}
            />
            <ListsHelp id="lists-help-broadcast" />
          </div>
        </FieldSet>
      )}
    </div>
  );
}
