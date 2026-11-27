"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonAnchor } from "@/components/ui/Button";
import Turnstile from "@/components/ui/Turnstile";
import { spamCheckCopy } from "@/lib/content/spam-check";
import { waitingRoomJoinCopy as copy } from "@/lib/content/whatsapp";
import type { ChatLinkResult } from "@/lib/broadcasts/waiting-room";
import { askChatLink } from "./chat-link";

/** Why there's no link: the server's reason, or that it couldn't be asked. */
type Missing = Exclude<ChatLinkResult, { ok: true }>["reason"] | "failed";

function said(missing: Missing): string {
  if (missing === "failed") return copy.failed;
  if (missing === "closed") return copy.closed;
  return spamCheckCopy.refused[missing];
}

/**
 * Joining the WhatsApp community: the spam check, then the button that
 * opens a chat with our number, a message asking to join typed in it, which
 * `ask` gets from the server (./chat-link.ts unless a test gives its own),
 * with the page's utm_source. Without a Turnstile key, as in development, it
 * asks at once.
 */
export default function WaitingRoomJoin({
  turnstileSiteKey,
  ask = askChatLink,
}: {
  turnstileSiteKey?: string;
  ask?: typeof askChatLink;
}) {
  const [link, setLink] = useState<string>();
  const [missing, setMissing] = useState<Missing>();
  // Bumped after a refusal to remount Turnstile: its tokens are single use.
  const [round, setRound] = useState(0);

  async function askWith(token: string) {
    if (turnstileSiteKey && !token) return;
    const utmSource = new URLSearchParams(window.location.search).get("utm_source") ?? "";
    const result = await ask(token, utmSource).catch((): ChatLinkResult | "failed" => "failed");
    if (result !== "failed" && result.ok) {
      setLink(result.link);
      return;
    }
    setMissing(result === "failed" ? "failed" : result.reason);
    setRound((n) => n + 1);
  }

  useEffect(() => {
    // Nothing to wait for without Turnstile. Asked once, as the page opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!turnstileSiteKey) void askWith("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      {link ? (
        <>
          <ButtonAnchor variant="primary" size="large" href={link}>
            {copy.button}
          </ButtonAnchor>
          <p>{copy.opens}</p>
        </>
      ) : (
        <>
          {turnstileSiteKey && (
            <>
              <p>{copy.check}</p>
              <Turnstile key={round} siteKey={turnstileSiteKey} onToken={(token) => void askWith(token)} />
            </>
          )}
          {missing && <p role="alert">{said(missing)}</p>}
        </>
      )}
      <p>
        {copy.privacy} <Link href="/privacy">{copy.privacyLink}</Link>.
      </p>
    </>
  );
}
