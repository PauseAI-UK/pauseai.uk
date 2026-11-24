import { now } from "@/lib/now";
import { json, type Fake } from "../fake";
import { fixtureUuid, UUIDS } from "../fixture-uuid";
import { historyIdOf, keepSent, lettersInboxResponse, lettersMailbox } from "../letters-inbox";
import { policyMailResponse } from "../policy-mailbox";

/** Each email the fixture Gmail sent, whole, and when, by its ID, for the life of the process. */
const SENT_GMAIL = ((globalThis as { fixtureSentGmail?: Map<string, { raw: string; at: number }> }).fixtureSentGmail ??=
  new Map());

/** An account's name: its address's words, capitalised, as a person would set it. */
function fixtureName(account: string): string {
  return account
    .split("@")[0]
    .split(/[.\-_]/)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Google's OAuth and Gmail, for any account. A token names its account
// (lib/server/outside-services/gmail.server.ts makes the code "fixture:<account>"),
// so the profile says whose it is. A mailbox has no messages, but joseph@'s
// and policy@'s (policy-mailbox.ts): the tests that read one give their own.
function googleResponse(
  hostname: string,
  pathname: string,
  params: URLSearchParams,
  init?: RequestInit,
  scope?: string,
): Response | undefined {
  if (hostname === "oauth2.googleapis.com" && pathname === "/token") {
    const form = new URLSearchParams(String(init!.body));
    const account = (form.get("code") ?? form.get("refresh_token")!).replace(/^fixture(-refresh)?:/, "");
    // An ID token as Google's: header, claims and signature, each base64url, its claims the account's address and name.
    const claims = Buffer.from(
      JSON.stringify({ email: account, email_verified: true, name: fixtureName(account) }),
    ).toString("base64url");
    return json({
      access_token: `fixture-access:${account}`,
      expires_in: 3599,
      ...(form.get("code") && { refresh_token: `fixture-refresh:${account}`, id_token: `e30.${claims}.fixture` }),
    });
  }
  if (hostname === "oauth2.googleapis.com" && pathname === "/revoke") return json({});
  if (hostname !== "gmail.googleapis.com") return undefined;
  const account = new Headers(init!.headers).get("authorization")!.replace(/^Bearer fixture-access:/, "");
  const letters = account === process.env.LETTERS_INBOX?.toLowerCase();
  const path = pathname.replace(/^\/gmail\/v1\/users\/me/, "");
  const inbox = letters && lettersInboxResponse(path, params, init, scope);
  if (inbox) return inbox;
  const policy = policyMailResponse(account, path, params);
  if (policy) return policy;
  if (pathname.endsWith("/profile")) {
    return json({ emailAddress: account, historyId: String(letters ? historyIdOf(lettersMailbox(scope)) : 1000) });
  }
  if (pathname.endsWith("/settings/sendAs")) {
    return json({ sendAs: [{ sendAsEmail: account, displayName: fixtureName(account), isPrimary: true }] });
  }
  // The same email gets the same IDs every run, as Postmark's MessageID: from what it says, not the UUIDs
  // each run makes afresh, its MIME boundaries and Message-IDs, and those it answers (lib/server/mime.server.ts).
  if (pathname.endsWith("/messages/send")) {
    const sending = JSON.parse(String(init!.body)) as { raw: string; threadId?: string };
    const raw = Buffer.from(sending.raw, "base64url").toString();
    const id = fixtureUuid(raw.replace(UUIDS, "uuid")).replace(/-/g, "").slice(0, 16);
    SENT_GMAIL.set(id, { raw, at: now().getTime() });
    // The letters inbox keeps what it sent; mail to one of its own addresses, as the supporter's copy is, comes back to it.
    if (letters) keepSent(raw, id, toLettersInbox(raw), scope);
    // In the thread it joins, as an answer to a message there is; else a thread of its own.
    return json({ id, threadId: sending.threadId ?? id, labelIds: ["SENT"] });
  }
  // An email it sent, whole, or by its headers: the Message-ID it was sent with, kept as it was, and who it's from
  // and its subject; dated when it went.
  const sent = /\/messages\/(\w+)$/.exec(pathname)?.[1];
  const kept = sent && SENT_GMAIL.get(sent);
  if (kept && params.get("format") === "raw")
    return json({ id: sent, raw: Buffer.from(kept.raw).toString("base64url") });
  if (kept) {
    const header = (name: string) => new RegExp(`^${name}: *(.+)$`, "im").exec(kept.raw)?.[1].trim() ?? "";
    return json({
      id: sent,
      threadId: sent,
      labelIds: ["SENT"],
      internalDate: String(kept.at),
      payload: { headers: ["Message-ID", "From", "Subject"].map((name) => ({ name, value: header(name) })) },
    });
  }
  if (pathname.endsWith("/history")) return json({ historyId: "1000" });
  if (pathname.endsWith("/messages")) return json({ resultSizeEstimate: 0 });
  return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 });
}

/** Whether a message is to one of the letters inbox's addresses (LETTERS_INBOX), its own or a proxy, in its To, Cc or Bcc. */
function toLettersInbox(raw: string): boolean {
  const [local, domain] = process.env.LETTERS_INBOX!.toLowerCase().split("@");
  const head = raw.slice(0, raw.search(/\r?\n\r?\n/));
  return [...head.matchAll(/^(?:To|Cc|Bcc):(.*)$/gim)].some(([, line]) =>
    [...line.toLowerCase().matchAll(/[^\s<>",]+@[^\s<>",]+/g)].some(([address]) => {
      const [user, host] = address.split("@");
      return host === domain && user.split("+")[0] === local;
    }),
  );
}

export const googleFake: Fake = ({ hostname, pathname, searchParams }, init, scope) =>
  googleResponse(hostname, pathname, searchParams, init, scope);
