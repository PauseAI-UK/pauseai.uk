// What a draft mailing warns of above Send, where it looks like a mistake
// but may not be one: each can be sent past.
import { ANSWER_CHOICES, type AskKind, type AskStatus } from "@/lib/asks/asks";
import { answerCondition } from "./fields";

/** Someone a mailing goes to, with the answers they've given (MailingPolitician's `answers`). */
type Answering = { id: number; name: string; meets: string[] };

/** Of those a mailing goes to, those who have already answered its ask, and how many gave each answer. */
export type AlreadyAnswered = { who: { id: number; name: string }[]; answers: { status: AskStatus; count: number }[] };

/**
 * Of `recipients`, those who have already answered `ask`, the mailing's,
 * and how many gave each of its kind's answers, in the order staff pick from them, those none
 * gave left out. No one, with no ask.
 */
export function alreadyAnswered(
  recipients: Answering[],
  ask: { slug: string; kind: AskKind } | undefined,
): AlreadyAnswered {
  if (!ask) return { who: [], answers: [] };
  const answers = ANSWER_CHOICES[ask.kind]
    .map((status) => {
      const condition = answerCondition(ask.slug, status);
      return { status, gave: recipients.filter((one) => one.meets.includes(condition)) };
    })
    .filter(({ gave }) => gave.length > 0);
  return {
    who: answers.flatMap(({ gave }) => gave.map(({ id, name }) => ({ id, name }))),
    answers: answers.map(({ status, gave }) => ({ status, count: gave.length })),
  };
}
