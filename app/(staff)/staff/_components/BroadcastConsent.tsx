"use client";

import { Segmented } from "@/components/ui/Controls";
import { FieldSet } from "@/components/ui/Field";
import { staffCopy } from "@/lib/content/staff-interface";
import { consentChoice } from "@/lib/broadcasts";
import { TOPICS, consentKey, stateValue, type Channel } from "@/lib/contact-permissions";
import ChannelIcon from "./ChannelIcon";

const copy = staffCopy.broadcastPages;

const CHANNELS: Channel[] = ["email", "phone"];

/**
 * The Consent a broadcast goes under, which says whether it's an email or a
 * text and what it's about: first email or text, then, in a row, the topics
 * by it, as the Consent filter orders them, and last the newsletter or events
 * both; a text goes under a yes by text. `value` is the one chosen, as
 * consentChoice writes it, or none yet. Once it has words of its own
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
            icon: <ChannelIcon channel={one === "email" ? "email" : "text"} />,
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
            options={[
              ...TOPICS.map((topic) => {
                const way = shown === "email" ? "email" : "text";
                return {
                  value: stateValue({ way, topic, send: "yes" }),
                  label: staffCopy.supporters.subscriptions.consents[consentKey({ way, topic })],
                };
              }),
              // The newsletter's and events' yeses both, for a broadcast about our events.
              {
                value: consentChoice({
                  channel: shown === "email" ? "email" : "text",
                  topic: "newsletter",
                  alsoEvents: true,
                }),
                label: copy.newsletterOrEvents,
              },
            ]}
            value={value}
            onChange={(chosen) => chosen !== value && pick(chosen)}
            disabled={pending}
          />
        </FieldSet>
      )}
    </div>
  );
}
