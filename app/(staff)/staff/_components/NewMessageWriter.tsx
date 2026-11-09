"use client";

import { useState, type ComponentProps } from "react";
import type { Channel } from "@/lib/contact-permissions";
import MessageWriter from "./MessageWriter";

/**
 * New broadcast's writer: blank, its greyed sections an email's or a
 * text's as Email or text is picked, so what's to come matches the choice.
 */
export default function NewMessageWriter(props: Omit<ComponentProps<typeof MessageWriter>, "blank" | "chosen">) {
  const [channel, setChannel] = useState<Channel | "">("");
  const draft = { ...props.draft, channel: channel === "phone" ? ("text" as const) : ("email" as const) };
  return <MessageWriter {...props} key={draft.channel} draft={draft} blank chosen={channel} onChannel={setChannel} />;
}
