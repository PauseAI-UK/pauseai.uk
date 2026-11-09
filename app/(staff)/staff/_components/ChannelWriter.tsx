"use client";

import { useState, type ComponentProps } from "react";
import type { Channel } from "@/lib/contact-permissions";
import { EMPTY_MAILING_DOC } from "@/lib/mailing-doc";
import MessageWriter from "./MessageWriter";

/**
 * A broadcast's writer that follows Email or text: while the channel picked
 * isn't the draft's own, as on New broadcast before any is, the sections
 * after it are that channel's, blank and greyed, till a Consent by it is
 * chosen, so what's to come matches the choice. Picking the draft's own
 * channel again shows it as it was. `fresh` is New broadcast, whose Consent
 * makes the draft.
 */
export default function ChannelWriter({
  fresh = false,
  ...props
}: Omit<ComponentProps<typeof MessageWriter>, "blank" | "chosen" | "onChannel" | "creating"> & { fresh?: boolean }) {
  const own: Channel = props.draft.channel === "email" ? "email" : "phone";
  const [channel, setChannel] = useState<Channel | "">(fresh ? "" : own);
  if (!fresh && channel === own) {
    return <MessageWriter {...props} key={own} chosen={channel} onChannel={setChannel} />;
  }
  const draft = {
    ...props.draft,
    channel: channel === "phone" ? ("text" as const) : ("email" as const),
    subject: "",
    body: EMPTY_MAILING_DOC,
    template: null,
  };
  // To no one yet, as who it goes to depends on the Consent still to be chosen.
  const data = { ...props.data, count: 0, recipients: [], leftOut: [] };
  return (
    <MessageWriter
      {...props}
      key={`blank-${draft.channel}`}
      data={data}
      draft={draft}
      blank
      creating={fresh}
      chosen={channel}
      onChannel={setChannel}
    />
  );
}
