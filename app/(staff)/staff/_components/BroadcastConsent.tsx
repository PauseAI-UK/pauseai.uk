"use client";

import { Segmented, Toggles } from "@/components/ui/Controls";
import { FieldSet } from "@/components/ui/Field";
import { staffCopy } from "@/lib/content/staff-interface";
import { choiceTerms, consentChoice } from "@/lib/broadcasts";
import { TOPICS, consentKey, type Channel, type Topic } from "@/lib/contact-permissions";
import ChannelIcon from "@/components/ui/ChannelIcon";
import LinkButton from "@/components/ui/LinkButton";
import { useState } from "react";
import own from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

const CHANNELS: Channel[] = ["email", "phone"];

/**
 * The Consent a broadcast goes under, which says whether it's an email or a
 * text and what it's about: first email or text, then the topics by it, as
 * the Consent filter orders them: one, or, after + Add, any of them, "or"
 * between, as the Consent filter's chip offers; a text goes under a yes by
 * text. `value` is the one chosen, as
 * consentChoice writes it, or none yet. Once it has words of its own
 * (`written`), the other channel can't be chosen, so none are lost. `shown`
 * is the channel whose topics show, and `show` shows another's; a topic
 * picked on a channel not the broadcast's starts it on that one alone.
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
  // The topics on: the broadcast's, while its own channel shows.
  const on = terms && shown === channel ? terms.topics : [];
  // One topic, until + Add offers several; any it has already are several.
  const [many, setMany] = useState(false);
  const several = many || on.length > 1;
  const topics = TOPICS.map((topic) => ({
    value: topic,
    label: staffCopy.supporters.subscriptions.consents[consentKey({ way, topic })],
  }));
  const choose = (chosen: Topic[]) => pick(consentChoice({ channel: way, topics: chosen }));
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
            {several ? (
              <Toggles<Topic>
                label={copy.facts.saidYes}
                options={topics}
                values={on}
                joiner={staffCopy.filters.anyOf(["", ""]).trim()}
                min={1}
                onChange={choose}
                busy={pending}
              />
            ) : (
              <Segmented<Topic>
                label={copy.facts.saidYes}
                options={topics}
                // None chosen yet matches no option, so none is checked.
                value={on[0] as Topic}
                onChange={(topic) => topic !== on[0] && choose([topic])}
                busy={pending}
              />
            )}
            <LinkButton
              onClick={() => {
                setMany(!several);
                if (several && on.length > 1) choose(on.slice(0, 1));
              }}
            >
              {several ? staffCopy.filters.justOne : staffCopy.filters.addChoice}
            </LinkButton>
          </div>
        </FieldSet>
      )}
    </div>
  );
}
