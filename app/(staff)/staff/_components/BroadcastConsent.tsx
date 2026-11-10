"use client";

import { Segmented } from "@/components/ui/Controls";
import { FieldSet } from "@/components/ui/Field";
import { staffCopy } from "@/lib/content/staff-interface";
import { sendsOf, stateValue, type Channel } from "@/lib/contact-permissions";
import ChannelIcon from "./ChannelIcon";
import { SUBSCRIPTION_ORDER } from "./SupporterFilters";

const copy = staffCopy.broadcastPages;

/** The Consents a broadcast can go under: each topic someone can be sure to have said yes to, as the Consent filter orders them. */
const CONSENTS = SUBSCRIPTION_ORDER.filter(([channel, topic]) => sendsOf(channel, topic).includes("yes"));

const CHANNELS: Channel[] = ["email", "phone"];

/**
 * The Consent a broadcast goes under, which says whether it's an email or a
 * text and what it's about: first email or text, then, in a row, the topics
 * someone can have said yes to by it. `value` is the one chosen, as the
 * Consent filter writes it, or none yet. Once it has words of its own
 * (`written`), the other channel can't be chosen, so none are lost.
 * `shown` is the channel whose topics show, and `show` shows another's.
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
  return (
    <div className={className}>
      <FieldSet label={copy.consentChannel}>
        <Segmented<Channel>
          label={copy.consentChannel}
          options={CHANNELS.map((one) => ({
            value: one,
            label: copy.channels[one === "email" ? "email" : "text"],
            icon: <ChannelIcon channel={one} />,
            disabled: written && one !== channel,
          }))}
          // None chosen yet matches no option, so none is checked.
          value={shown as Channel}
          onChange={show}
          disabled={pending}
        />
      </FieldSet>
      {shown && (
        <FieldSet label={copy.facts.saidYes}>
          <Segmented
            label={copy.facts.saidYes}
            options={CONSENTS.filter(([one]) => one === shown).map(([one, topic]) => ({
              value: stateValue({ channel: one, topic, send: "yes" }),
              label: staffCopy.supporters.subscriptions.topics[one][topic],
            }))}
            value={value}
            onChange={(chosen) => chosen !== value && pick(chosen)}
            disabled={pending}
          />
        </FieldSet>
      )}
    </div>
  );
}
