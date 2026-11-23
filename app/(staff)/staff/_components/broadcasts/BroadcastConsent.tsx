"use client";

import { Segmented } from "@/components/ui/Controls";
import { FieldSet } from "@/components/ui/Field";
import { choiceTerms, consentChoice } from "@/lib/broadcasts/broadcasts";
import { LIST_TOPICS, listOf, listsBy, type Channel } from "@/lib/supporters/contact-permissions";
import ChannelIcon from "@/components/ui/ChannelIcon";
import own from "./Broadcasts.module.css";
import { supportersCopy } from "../supporters/copy";
import { ListHelp } from "../supporters/PermissionTiles";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

const CHANNELS: Channel[] = ["email", "phone"];

/**
 * The Consent a broadcast goes under, which says whether it's an email or a
 * text and who it goes to: first email or text, then one of the lists by
 * it, as the Consent filter names and orders them, a lozenge each on the
 * line below, with a "?" after it saying who it's for; a text goes to a
 * list's yeses by text. `value` is the one chosen, as consentChoice writes it, or
 * none yet. Once it has words of its own (`written`), the other channel
 * can't be chosen, so none are lost. `shown` is the channel whose lists
 * show, and `show` shows another's; a list picked on a channel not the
 * broadcast's starts it on that one. While a pick is on its way (`pending`),
 * another does nothing.
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
  return (
    <div className={className}>
      <FieldSet label={copy.consentChannel}>
        <div className={own.channels}>
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
        </div>
      </FieldSet>
      {shown && (
        <FieldSet label={copy.facts.list}>
          <div className={own.lists} role="radiogroup" aria-label={copy.facts.list} aria-busy={pending || undefined}>
            {lists.map(({ value: list, label }) => (
              <span key={list} className={own.list}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={list === on}
                  className={own.listChoice}
                  onClick={() =>
                    !pending && list !== on && pick(consentChoice({ channel: way, topics: LIST_TOPICS[list] }))
                  }
                >
                  {label}
                </button>
                <ListHelp list={list} />
              </span>
            ))}
          </div>
        </FieldSet>
      )}
    </div>
  );
}
