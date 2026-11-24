// The spam check's words, for every form it guards (Email your MP, asking
// for a link to your contact preferences): why the check refused a form,
// by its reason (lib/server/outside-services/turnstile.server.ts), and what
// its widget says when it can't load (components/ui/Turnstile.tsx).

/** Why the spam check refused a form. */
export type SpamReason = "spam-unavailable" | "spam-misconfigured" | "spam-wait" | "spam-failed" | "spam-unreachable";

export const spamCheckCopy = {
  refused: {
    "spam-unavailable": "Spam protection is unavailable.",
    "spam-misconfigured": "Spam protection is misconfigured.",
    "spam-wait": "Please wait for the anti-spam check to complete, then send your message again.",
    "spam-failed": "The anti-spam check failed. Please reload the page and try again.",
    "spam-unreachable": "Could not complete the anti-spam check. Please try again in a moment.",
  } satisfies Record<SpamReason, string>,
  load: "The anti-spam check could not load. Please refresh the page and try again.",
};
