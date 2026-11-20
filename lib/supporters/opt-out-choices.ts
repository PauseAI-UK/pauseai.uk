import { CONSENTS, type ContactPermission, type Topic, type Way } from "./contact-permissions";

// What staff can record a supporter as opting out of, when the person tells
// them some way the site doesn't hear: what we can send them now, each topic
// by each way, at each of their addresses and numbers, and every bulk email
// at each address. Nothing staff record can opt them back in.

/** One thing to opt out of: a topic by a way, or by email every bulk email, at an address or number. */
export type OptOutChoice = { address: string; way: Way; list: Topic | "bulk" };

/** A choice as a form sends it. */
export function choiceValue({ address, way, list }: OptOutChoice): string {
  return `${way}|${list}|${address}`;
}

/** An answer about a supporter's address or number, as far as it says what we can send it. */
type Answer = Pick<ContactPermission, "address" | "channel" | "topic" | "way" | "send">;

/**
 * What can be opted out of: just what the supporter's consents say we can
 * send them (`permissions`, their answers), each topic by each way with a
 * yes, and every bulk email at an address with any yes by email; under each
 * address by email, then each number by text, then by call. For someone
 * on our Luma calendar (`onLuma`), events by email too at each address with
 * an answer about events by email, even a no, as Luma's own messages still
 * go there till they opt out of them. The newsletter by email too wherever
 * events by email is a yes, as PauseAI UK Updates inc. Luma goes there: a no
 * to it stops our emails and leaves them on the calendar, as the link in
 * one of those emails does. Events by text only where the newsletter by
 * text isn't a yes too: there, opting out of events alone would stop
 * nothing, as PauseAI UK Updates still goes to the number.
 */
export function optOutChoices(permissions: Answer[], onLuma = false): OptOutChoice[] {
  const yes = permissions.filter((p) => p.send === "yes");
  const luma = onLuma ? permissions.filter((p) => p.way === "email" && p.topic === "events") : [];
  const addresses = (channel: "email" | "phone") => [
    ...new Set([...yes, ...luma].filter((p) => p.channel === channel).map((p) => p.address)),
  ];
  const has = (address: string, way: Way, topic: Topic, among: Answer[]) =>
    among.some((p) => p.address === address && p.way === way && p.topic === topic);
  const offered = (address: string, way: Way, topic: Topic) => {
    if (topic === "events" && way === "text" && has(address, "text", "newsletter", yes)) return false;
    return (
      has(address, way, topic, [...yes, ...luma]) ||
      (topic === "newsletter" && way === "email" && has(address, "email", "events", yes))
    );
  };
  const topics = (address: string, way: Way): OptOutChoice[] =>
    CONSENTS.filter((c) => c.way === way && offered(address, way, c.topic)).map((c) => ({
      address,
      way,
      list: c.topic,
    }));
  // By email, the lists, then Luma's own messages, as the rows of a supporter's page go, then every bulk email.
  const lumaLast = (choices: OptOutChoice[]) => [
    ...choices.filter((choice) => choice.list !== "events"),
    ...choices.filter((choice) => choice.list === "events"),
  ];
  return [
    ...addresses("email").flatMap((address) => [
      ...lumaLast(topics(address, "email")),
      { address, way: "email" as const, list: "bulk" as const },
    ]),
    ...addresses("phone").flatMap((address) => [...topics(address, "text"), ...topics(address, "call")]),
  ];
}

/** The choice a form sent, if it's one of `choices`. */
export function chosen(value: unknown, choices: OptOutChoice[]): OptOutChoice | undefined {
  return choices.find((choice) => choiceValue(choice) === value);
}
