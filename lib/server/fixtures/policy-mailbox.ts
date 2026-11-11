// The fake Gmail's joseph@ and policy@ (outside-services.ts): policy@ has a
// stranger's question, which matches no politician, and Polly writing from her
// own Gmail, which matches no one until staff add it to hers. Joseph's is empty.

/** A message: the mailbox it's in, its Gmail IDs, labels and whole text. */
type Mail = { account: string; id: string; threadId: string; labels: string[]; at: string; raw: string };

const JOSEPH_MAILBOX = "joseph@pauseai.uk";
const POLICY_MAILBOX = "policy@pauseai.uk";

/** Polly's own Gmail: on no list, so her mail from it matches nothing until staff add it to hers. */
export const POLLY_PERSONAL = "polly.placeholder.home@gmail.example";

/** One email to policy@, its lines ending CRLF. */
function mail(id: string, threadId: string, at: string, from: string, subject: string, text: string): Mail {
  return {
    account: POLICY_MAILBOX,
    id,
    threadId,
    labels: ["INBOX"],
    at,
    raw: [
      `From: ${from}`,
      `To: ${POLICY_MAILBOX}`,
      `Subject: ${subject}`,
      `Message-ID: <${id}@example.com>`,
      `Date: ${new Date(at).toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      text.replace(/\n/g, "\r\n"),
    ].join("\r\n"),
  };
}

const MAIL: readonly Mail[] = [
  mail(
    "0b02",
    "t-stray",
    "2026-10-31T09:00:00.000Z",
    "Sue Stranger <sue.stranger@example.com>",
    "Are you hiring?",
    "Are you?",
  ),
  mail(
    "0b11",
    "t-personal",
    "2026-11-02T08:00:00.000Z",
    `Polly Placeholder <${POLLY_PERSONAL}>`,
    "From my own address",
    "Please use this address for anything urgent.\n\nPolly",
  ),
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

/** A message's headers, by name as written. */
function headersOf(raw: string): { name: string; value: string }[] {
  return raw
    .slice(0, raw.indexOf("\r\n\r\n"))
    .split("\r\n")
    .map((line) => ({ name: line.slice(0, line.indexOf(":")), value: line.slice(line.indexOf(":") + 1).trim() }));
}

/**
 * The Gmail API for these two mailboxes: a search for one address, as adding
 * one to a politician's makes, which finds the mail with it anywhere, and
 * nothing for any other; a message by its format; and a thread. Undefined for
 * what it doesn't answer, as the fake for every account does, such as an
 * account's profile.
 */
export function policyMailResponse(account: string, path: string, params: URLSearchParams): Response | undefined {
  if (account !== JOSEPH_MAILBOX && account !== POLICY_MAILBOX) return undefined;
  const mine = MAIL.filter((m) => m.account === account);
  if (path === "/messages") {
    const address = /^"(.+)"$/.exec(params.get("q")!)?.[1];
    const found = address ? mine.filter((m) => m.raw.toLowerCase().includes(address)) : [];
    return json({ messages: found.map(({ id, threadId }) => ({ id, threadId })) });
  }
  const thread = /^\/threads\/([\w-]+)$/.exec(path)?.[1];
  if (thread) return json({ messages: mine.filter((m) => m.threadId === thread).map(({ id }) => ({ id })) });
  const id = /^\/messages\/(\w+)$/.exec(path)?.[1];
  const message = mine.find((m) => m.id === id);
  if (!message) return undefined;
  const base = {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labels,
    internalDate: String(Date.parse(message.at)),
  };
  if (params.get("format") === "raw") return json({ ...base, raw: Buffer.from(message.raw).toString("base64url") });
  const headers = headersOf(message.raw);
  if (params.get("format") === "full") {
    const text = message.raw.slice(message.raw.indexOf("\r\n\r\n") + 4);
    return json({
      ...base,
      payload: { headers, mimeType: "text/plain", body: { data: Buffer.from(text).toString("base64url") } },
    });
  }
  const wanted = params.getAll("metadataHeaders").map((name) => name.toLowerCase());
  return json({ ...base, payload: { headers: headers.filter((h) => wanted.includes(h.name.toLowerCase())) } });
}
