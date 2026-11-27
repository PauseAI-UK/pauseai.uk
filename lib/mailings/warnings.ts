// What a draft mailing warns of under Who, where it looks like a mistake
// but may not be one: each can be sent past.
import { ANSWER_CHOICES, type AskKind, type AskStatus } from "@/lib/asks/asks";
import { answerCondition } from "./doc";

/** Someone a mailing goes to, with the answers they've given (MailingPolitician's `answers`). */
type Answering = { id: number; name: string; meets: string[] };

/** Of those a mailing goes to, those who have already answered its ask, each with their answer, and how many gave each. */
export type AlreadyAnswered = {
  who: { id: number; name: string; status: AskStatus }[];
  answers: { status: AskStatus; count: number }[];
};

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
    who: answers.flatMap(({ status, gave }) => gave.map(({ id, name }) => ({ id, name, status }))),
    answers: answers.map(({ status, gave }) => ({ status, count: gave.length })),
  };
}
