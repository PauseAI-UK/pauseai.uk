"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import Turnstile from "@/components/ui/Turnstile";
import { spamCheckCopy } from "@/lib/content/spam-check";
import { waitingRoomJoinCopy as copy } from "@/lib/content/whatsapp";
import type { ChatLinkResult } from "@/lib/broadcasts/waiting-room";
import { askChatLink } from "./chat-link";
import card from "@/components/ui/Card.module.css";
import styles from "./WaitingRoomJoin.module.css";

/** Why there's no link: the server's reason, or that it couldn't be asked. */
type Missing = Exclude<ChatLinkResult, { ok: true }>["reason"] | "failed";

function said(missing: Exclude<Missing, "closed">): string {
  return missing === "failed" ? copy.failed : spamCheckCopy.refused[missing];
}

/**
 * Joining the WhatsApp community: the spam check, then the button that
 * opens a chat with our number, a message asking to join typed in it, which
 * `ask` gets from the server (./chat-link.ts unless a test gives its own),
 * with the page's utm_source. Without a Turnstile key, as in development, it
 * asks at once. Not `open`, it says only that joining is closed.
 */
export default function WaitingRoomJoin({
  open = true,
  turnstileSiteKey,
  ask = askChatLink,
}: {
  open?: boolean;
  turnstileSiteKey?: string;
  ask?: typeof askChatLink;
}) {
  const [link, setLink] = useState<string>();
  // Closed as the page was made, there's nothing to check or ask.
  const [missing, setMissing] = useState<Missing | undefined>(open ? undefined : "closed");
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
    if (open && !turnstileSiteKey) void askWith("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closed, the page says only that: the rest would ask them to message us.
  if (missing === "closed") {
    return (
      <>
        <h1>{copy.title}</h1>
        <div className={styles.closed}>
          <p role="alert">{copy.closed}</p>
        </div>
      </>
    );
  }
  return (
    <>
      <h1>{copy.title}</h1>
      <div className={`${card.card} ${styles.card}`}>
        <p>{copy.body}</p>
        {/* One place, the spam check's height: the check while it's checking, then the button in its place. */}
        <div className={styles.slot}>
          {link ? (
            <ButtonAnchor variant="primary" size="large" href={link}>
              {copy.button}
            </ButtonAnchor>
          ) : turnstileSiteKey ? (
            <Turnstile key={round} siteKey={turnstileSiteKey} onToken={(token) => void askWith(token)} />
          ) : (
            <Button variant="primary" size="large" disabled>
              {copy.button}
            </Button>
          )}
        </div>
        {missing && <p role="alert">{said(missing)}</p>}
        <p className={styles.quiet}>{copy.newsletter}</p>
      </div>
      <p className={styles.privacy}>
        {copy.privacy} <Link href="/privacy">{copy.privacyLink}</Link>.
      </p>
    </>
  );
}
