import { afterEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db";
import { addFormEntry } from "@/lib/server/form-entries";
import { hashOf, newSettingsLink } from "@/lib/server/email-settings";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { notifications } from "@/tests/notifications";
import { POST } from "@/app/api/unsubscribe/[token]/route";
import {
  askForLinkNow,
  liftNoBulkNow,
  resendLinkNow,
  saveSettingsNow,
  stopEverythingNow,
  unsubscribeNow,
} from "./actions";

const JANE = "jane.smith@example.com";

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of [value].flat()) data.append(name, each);
  }
  return data;
}

async function jane() {
  await addFormEntry("march-2026-11", {
    name: "Jane Smith",
    email: JANE,
    phone: null,
    city: null,
    postcode: null,
    consent: true,
    utmSource: null,
  });
}

/** A link to Jane's page: its token. */
const linkToken = async () => (await newSettingsLink(JANE)).split("/").at(-1)!;

/** A copy of a broadcast to Jane, under the newsletter: its link's token. */
async function copyToken(): Promise<string> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
     VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
  );
  await query(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, link_token_hash, topics, sent_at)
     VALUES ($1, (SELECT min(supporter_id) FROM supporter_links), $2, 'sent', $3, '{newsletter}', now())`,
    [id, JANE, hashOf("copy-token")],
  );
  return "copy-token";
}

/** What the actions left to do after their answer, as next/server's `after` would run it. */
const later: Promise<unknown>[] = [];
vi.mock("next/server", async (importActual) => ({
  ...(await importActual<typeof import("next/server")>()),
  after: (work: () => unknown) => void later.push(Promise.resolve(work())),
}));

/** Waits for what the actions left to do after their answer. */
const afterAnswers = async () => Promise.all(later.splice(0));

afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("the contact preferences page's actions", () => {
  useTestDatabase();

  it("emails a link to an address we have, past the spam check, saying the same whoever's it is", async () => {
    const sent = notifications();
    await jane();
    expect(await askForLinkNow(form({ email: ` ${JANE} ` }))).toEqual({ sent: JANE });
    expect(await askForLinkNow(form({ email: "nobody@example.com" }))).toEqual({ sent: "nobody@example.com" });
    await afterAnswers();
    expect(sent.map((email) => email.To)).toEqual([JANE]);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    expect(await askForLinkNow(form({ email: JANE }))).toEqual({ message: expect.any(String) });
  });

  it("saves, lifts “No bulk emails” and stops everything for the link's address, only while it works", async () => {
    await jane();
    const token = await linkToken();
    const view = await saveSettingsNow(form({ token, choice: ["volunteering:email"] }));
    expect(view?.answers.find((a) => a.topic === "volunteering")).toMatchObject({ send: "yes", reason: "chose" });
    expect((await stopEverythingNow(form({ token })))?.hold).toMatchObject({ kind: "no-bulk" });
    expect((await liftNoBulkNow(form({ token })))?.hold).toBeNull();
    await query("UPDATE preference_links SET expires_at = now()");
    expect(await saveSettingsNow(form({ token, choice: [] }))).toBeNull();
    expect(await saveSettingsNow(form({ kind: "copy", token: "nope" }))).toBeNull();
  });

  it("unsubscribes by an email's button, and gives its page while it works", async () => {
    await jane();
    const token = await copyToken();
    const done = await unsubscribeNow(form({ kind: "copy", token }));
    expect(done).toMatchObject({ done: true, view: { address: JANE } });
    await query("UPDATE broadcast_messages SET sent_at = now() - interval '40 days'");
    expect(await unsubscribeNow(form({ kind: "copy", token }))).toEqual({ done: true, view: null });
    expect(await unsubscribeNow(form({ kind: "copy", token: "nope" }))).toEqual({ done: false, view: null });
    expect(await query("SELECT list, source FROM opt_outs")).toEqual([{ list: "newsletter", source: "link" }]);
  });

  it("emails a fresh link to the address an old link was for", async () => {
    const sent = notifications();
    await jane();
    const token = await linkToken();
    await query("UPDATE preference_links SET expires_at = now(), created_at = now() - interval '1 hour'");
    await resendLinkNow(form({ token }));
    await afterAnswers();
    expect(sent.map((email) => email.To)).toEqual([JANE]);
  });

  it("opts out by a mail app's one-click Unsubscribe, or says there's no such email", async () => {
    await jane();
    const token = await copyToken();
    const params = (token: string) => ({ params: Promise.resolve({ token }) });
    expect(
      (await POST(new Request("https://pauseai.uk/api/unsubscribe/x", { method: "POST" }), params(token))).status,
    ).toBe(200);
    expect(
      (await POST(new Request("https://pauseai.uk/api/unsubscribe/x", { method: "POST" }), params("nope"))).status,
    ).toBe(404);
    expect(await query("SELECT list, source FROM opt_outs")).toEqual([
      { list: "newsletter", source: "list-unsubscribe" },
    ]);
  });
});
