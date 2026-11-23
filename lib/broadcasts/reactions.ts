// Their emoji on our texts, as the bubbles of a copy's thread show them.
import type { MessageCopy } from "./pages.server";

/**
 * Their emoji on one of our messages, as WhatsApp shows it at the foot of
 * the bubble: on our answer WhatsApp calls `to`, or, with none, the
 * broadcast itself, which a reaction to nothing else is to. The latest they
 * haven't taken back, if it was kept.
 */
export function theirReaction(one: Pick<MessageCopy, "answers" | "replies">, to: string | null): string | undefined {
  const answers = new Set(one.answers.map((answer) => answer.providerId).filter(Boolean));
  const standing = one.replies.findLast(
    (reply) =>
      reply.kind === "reaction" && !reply.removedAt && (answers.has(reply.reactionTo) ? reply.reactionTo : null) === to,
  );
  return standing?.text || undefined;
}
