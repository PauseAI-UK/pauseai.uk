// What became of staff's answer to a reply, a broadcast's
// (lib/broadcasts/answers.server.ts) or a mailing's letter's
// (replies.server.ts), as the draft at the foot of the thread says it.

/**
 * What became of an answer: sent; or not, as it had no words, the reply's
 * gone, the address is blocked, Gmail or WhatsApp failed, or it's more than
 * a day since a reply to a text, when WhatsApp takes no words of ours.
 */
export type AnswerResult = { sent: true } | { sent: false; reason: "blank" | "gone" | "blocked" | "failed" | "window" };
