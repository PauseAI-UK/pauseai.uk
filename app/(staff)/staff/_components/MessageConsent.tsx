"use client";

import { Select } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { staffCopy } from "@/lib/content/staff-interface";
import { sendsOf, stateValue, type Channel } from "@/lib/contact-permissions";
import { SUBSCRIPTION_ORDER } from "./SupporterFilters";

const copy = staffCopy.messagePages;

/** The Consents a broadcast can go under: each topic someone can be sure to have said yes to, as the Consent filter orders them. */
const CONSENTS = SUBSCRIPTION_ORDER.filter(([channel, topic]) => sendsOf(channel, topic).includes("yes"));

/**
 * Said yes to: the Consent a broadcast goes under, which says whether it's
 * an email or a text and what it's about. `value` is the one chosen, as the
 * Consent filter writes it, or none yet. Once it has words of its own
 * (`written`), only those by its `channel` can be chosen, so none are lost.
 */
export default function MessageConsent({
  value,
  channel,
  written,
  pending,
  pick,
  className,
}: {
  value: string;
  channel: Channel;
  written: boolean;
  pending: boolean;
  pick: (value: string) => void;
  className?: string;
}) {
  return (
    <Field label={copy.facts.saidYes} className={className}>
      <Select value={value} disabled={pending} onChange={(event) => pick(event.target.value)}>
        {!value && (
          <option value="" disabled>
            {copy.chooseConsent}
          </option>
        )}
        {CONSENTS.map(([one, topic]) => (
          <option
            key={`${one}:${topic}`}
            value={stateValue({ channel: one, topic, send: "yes" })}
            disabled={written && one !== channel}
          >
            {staffCopy.supporters.subscriptions.topics[one][topic]}
          </option>
        ))}
      </Select>
    </Field>
  );
}
