import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications, type Notification } from "@/tests/notifications";
import { broadcastsCopy } from "./copy";
import { waitingRoomCopy, waitingRoomProblems } from "./waiting-room-copy";
import {
  communityLink,
  dismiss,
  emailHeld,
  letInByStaff,
  receiveWaitingRoomMessage,
  setCommunityLink,
  waitingRoom,
  waitingRoomOf,
  type Incoming,
} from "./waiting-room.server";

const JANE = "+447700900123";
const LINK = "https://chat.whatsapp.com/TestInvite";
const texts = waitingRoomCopy.texts;

let sent: Notification[];
/** What WhatsApp was asked to send: to whom, and the words. */
let said: { to: string; words: string }[];
/** Whether WhatsApp refuses what we send, as it does outside a person's day to hear from us. */
let refusing: boolean;

beforeEach(() => {
  sent = notifications();
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
  vi.stubEnv("ANTHROPIC_API_KEY", "key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  said = [];
  refusing = false;
  server.use(
    http.post(/graph\.facebook\.com\/.*\/messages$/, async ({ request }) => {
      const body = (await request.json()) as { to: string; text: { body: string } };
      if (refusing) return HttpResponse.json({ error: { code: 131047, message: "Too late" } }, { status: 400 });
      said.push({ to: `+${body.to}`, words: body.text.body });
      return HttpResponse.json({ messages: [{ id: `wamid.ours-${said.length}` }] });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

let ids = 0;
/** A message from Jane, unless it says another number: words, a photo, or quoting a message of ours. */
const from = (words: string | null, more: Partial<Incoming> = {}): Incoming => ({
  number: JANE,
  messageId: `wamid.in-${++ids}`,
  at: new Date(`2026-11-02T10:${String(ids).padStart(2, "0")}:00Z`),
  kept: words === null ? { kind: "image", body: null } : { kind: null, body: words },
  profileName: "Jane",
  ...more,
});

const JOIN = "Hi PauseAI UK, I'd like to join (parents)";
const REASON = "I'm a parent worried about AI and my kids, LS6 1AA jane.smith@example.com";

/** Jane, as the waiting room keeps her. */
const jane = async () => {
  const [row] = await query<{
    state: string;
    heldWhy: string | null;
    decidedBy: string | null;
    linkSent: boolean;
    checking: boolean;
    cameFrom: string | null;
    name: string;
  }>(
    `SELECT state, held_why AS "heldWhy", decided_by AS "decidedBy", link_sent_at IS NOT NULL AS "linkSent",
       checking_sent_at IS NOT NULL AS checking, came_from AS "cameFrom", profile_name AS name
     FROM waiting_room WHERE number = $1`,
    [JANE],
  );
  return row;
};

/** The form entry she became. */
const entry = async () => {
  const [row] = await query<{ form: string; name: string; email: string | null; postcode: string | null; utm: string }>(
    `SELECT f.form, f.name, f.email, f.postcode, f.utm_source AS utm FROM waiting_room w
     JOIN form_entries f ON f.id = w.entry_id WHERE w.number = $1`,
    [JANE],
  );
  return row;
};

const setLink = () => setCommunityLink(LINK, "jo@pauseai.uk");

/** Jane asks and replies, so is held, or let in where the link is set and her reply passes. */
async function asksAndReplies(reply: string) {
  await receiveWaitingRoomMessage(from(JOIN));
  await receiveWaitingRoomMessage(from(reply));
}

describeWithDatabase("the waiting room", () => {
  useTestDatabase();

  it("welcomes a message asking to join, keeping where they came from and their name", async () => {
    expect(await receiveWaitingRoomMessage(from(JOIN))).toBe(true);
    expect(said).toEqual([{ to: JANE, words: texts.welcome }]);
    expect(await jane()).toMatchObject({ state: "asked", cameFrom: "parents", name: "Jane" });
  });

  it("leaves a message from someone not in it that doesn't ask to join, or that quotes a message of ours that isn't its", async () => {
    expect(await receiveWaitingRoomMessage(from("Thanks for the update"))).toBe(false);
    expect(await receiveWaitingRoomMessage(from(JOIN, { quoted: "wamid.broadcast" }))).toBe(false);
    expect(said).toEqual([]);
  });

  it("takes each message once, though WhatsApp send it twice, and asks to join only once a number", async () => {
    const message = from(JOIN);
    await receiveWaitingRoomMessage(message);
    expect(await receiveWaitingRoomMessage(message)).toBe(true);
    expect(said).toHaveLength(1);
    const [{ n }] = await query<{ n: number }>("SELECT count(*)::int AS n FROM waiting_room_messages WHERE NOT ours");
    expect(n).toBe(1);
  });

  it("lets in a reply that passes the check: a supporter, by text, sent the link", async () => {
    await setLink();
    await asksAndReplies(REASON);
    expect(await jane()).toMatchObject({ state: "let-in", decidedBy: null, linkSent: true });
    expect(said.at(-1)).toEqual({ to: JANE, words: texts.link(LINK) });
    expect(await entry()).toEqual({
      form: "whatsapp-join",
      name: "Jane",
      email: "jane.smith@example.com",
      postcode: "LS6 1AA",
      utm: "parents",
    });
    const [{ supporters }] = await query<{ supporters: number }>(
      "SELECT count(DISTINCT supporter_id)::int AS supporters FROM supporter_links",
    );
    expect(supporters).toBe(1);
  });

  it("asks for a postcode under the link when they gave none", async () => {
    await setLink();
    await asksAndReplies("I'm worried about where AI is heading");
    expect(said.at(-1)?.words).toBe(`${texts.link(LINK)}\n\n${texts.postcode}`);
  });

  it("holds a reply the check holds, with why", async () => {
    await setLink();
    await asksAndReplies("hi");
    expect(await jane()).toMatchObject({ state: "held", heldWhy: "It gives no reason for joining." });
    expect(said).toHaveLength(1);
  });

  it("holds a reply that passes while no link is set, and one the check couldn't be asked of", async () => {
    await asksAndReplies(REASON);
    expect(await jane()).toMatchObject({ state: "held", heldWhy: null });
    server.use(http.post("https://api.anthropic.com/v1/messages", () => HttpResponse.json({}, { status: 500 })));
    await setLink();
    await receiveWaitingRoomMessage(from(JOIN, { number: "+447700900456" }));
    await receiveWaitingRoomMessage(from(REASON, { number: "+447700900456" }));
    const [other] = await query<{ state: string; why: string | null }>(
      "SELECT state, held_why AS why FROM waiting_room WHERE number = '+447700900456'",
    );
    expect(other).toEqual({ state: "held", why: null });
    expect(console.error).toHaveBeenCalledWith(waitingRoomProblems.checkFailed().what, expect.any(String));
  });

  it("takes the button pressed again, before a reply, as no reply", async () => {
    await setLink();
    await asksAndReplies(JOIN);
    expect(await jane()).toMatchObject({ state: "asked" });
  });

  it("tells someone held who writes again that we'll check, once", async () => {
    await asksAndReplies("hi");
    await receiveWaitingRoomMessage(from("hello?"));
    await receiveWaitingRoomMessage(from("anyone?"));
    expect(said.map((message) => message.words)).toEqual([texts.welcome, texts.checking]);
    expect(await jane()).toMatchObject({ checking: true });
  });

  it("keeps a new profile name", async () => {
    await receiveWaitingRoomMessage(from(JOIN));
    await receiveWaitingRoomMessage(from(null, { profileName: "Jane S" }));
    await receiveWaitingRoomMessage(from(null, { profileName: undefined }));
    expect(await jane()).toMatchObject({ name: "Jane S" });
  });

  it("sends the link when they next write, if WhatsApp wouldn't take it, and again if they ask to join again", async () => {
    await setLink();
    await receiveWaitingRoomMessage(from(JOIN));
    refusing = true;
    await receiveWaitingRoomMessage(from(REASON));
    expect(await jane()).toMatchObject({ state: "let-in", linkSent: false });
    expect(console.error).toHaveBeenCalledWith(waitingRoomProblems.notSent({ code: 131047 }).what);
    refusing = false;
    await receiveWaitingRoomMessage(from("thanks!"));
    expect(await jane()).toMatchObject({ linkSent: true });
    await receiveWaitingRoomMessage(from("Can I join again? lost the link"));
    expect(said.filter((message) => message.words === texts.link(LINK))).toHaveLength(2);
  });

  it("keeps a postcode or email they send later, and sends staff anything else", async () => {
    await setLink();
    await asksAndReplies("I'm worried about where AI is heading");
    await receiveWaitingRoomMessage(from("My postcode is E15 by the way"));
    expect(await entry()).toMatchObject({ postcode: "E15", email: null });
    await receiveWaitingRoomMessage(from("jane.smith@example.com is my email address, thanks"));
    expect(await entry()).toMatchObject({ postcode: "E15", email: "jane.smith@example.com" });
    expect(sent).toEqual([]);
    await receiveWaitingRoomMessage(from("When is the next march?"));
    await receiveWaitingRoomMessage(from(null));
    const email = broadcastsCopy.notifications.whatsAppMessage;
    expect(sent.map((message) => message.Subject)).toEqual([email.subject(JANE), email.subject(JANE)]);
  });

  it("says nothing to someone dismissed", async () => {
    await asksAndReplies("hi");
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM waiting_room");
    expect(await dismiss(id, "jo@pauseai.uk")).toEqual({ ok: true });
    await receiveWaitingRoomMessage(from("let me in"));
    expect(said).toHaveLength(1);
    expect(await jane()).toMatchObject({ state: "dismissed", decidedBy: "jo@pauseai.uk" });
  });

  it("reports a message WhatsApp took without saying its ID as not sent", async () => {
    server.use(http.post(/graph\.facebook\.com\/.*\/messages$/, () => HttpResponse.json({ messages: [] })));
    await receiveWaitingRoomMessage(from(JOIN));
    expect(console.error).toHaveBeenCalledWith(waitingRoomProblems.notSent({ code: 0 }).what);
  });

  it("sends no link to someone let in once there's none to send", async () => {
    await setLink();
    await receiveWaitingRoomMessage(from(JOIN));
    refusing = true;
    await receiveWaitingRoomMessage(from(REASON));
    refusing = false;
    await query("DELETE FROM waiting_room_links");
    await receiveWaitingRoomMessage(from("thanks!"));
    expect(await jane()).toMatchObject({ state: "let-in", linkSent: false });
  });

  it("takes a message quoting one of its own as its own", async () => {
    await receiveWaitingRoomMessage(from(JOIN));
    expect(await receiveWaitingRoomMessage(from("hi", { quoted: "wamid.ours-1" }))).toBe(true);
  });

  it("sends nothing while WhatsApp's keys aren't set, but keeps them", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await receiveWaitingRoomMessage(from(JOIN))).toBe(true);
    expect(said).toEqual([]);
    expect(await jane()).toMatchObject({ state: "asked" });
  });
});

describeWithDatabase("staff in the waiting room", () => {
  useTestDatabase();

  const janeId = async () => (await query<{ id: number }>("SELECT id::int AS id FROM waiting_room"))[0].id;

  it("let someone held in, with what they gave as the check reads it, sending the link", async () => {
    await asksAndReplies(REASON);
    const id = await janeId();
    expect(await letInByStaff(id, "jo@pauseai.uk")).toEqual({ ok: false, reason: "no-link" });
    await setLink();
    expect(await letInByStaff(id, "jo@pauseai.uk")).toEqual({ ok: true });
    expect(await jane()).toMatchObject({ state: "let-in", decidedBy: "jo@pauseai.uk", heldWhy: null, linkSent: true });
    expect(await entry()).toMatchObject({ postcode: "LS6 1AA", email: "jane.smith@example.com" });
    // Let in already: nothing more.
    expect(await letInByStaff(id, "sam@pauseai.uk")).toEqual({ ok: true });
    expect(said.filter((message) => message.words === texts.link(LINK))).toHaveLength(1);
  });

  it("let in someone who hasn't replied, with nothing to read", async () => {
    await setLink();
    await receiveWaitingRoomMessage(from(JOIN));
    expect(await letInByStaff(await janeId(), "jo@pauseai.uk")).toEqual({ ok: true });
    expect(await entry()).toMatchObject({ postcode: null, email: null });
  });

  it("leave someone decided as they are, and can't decide for someone gone", async () => {
    await setLink();
    await asksAndReplies(REASON);
    const id = await janeId();
    expect(await dismiss(id, "jo@pauseai.uk")).toEqual({ ok: true });
    expect(await jane()).toMatchObject({ state: "let-in" });
    expect(await dismiss(id + 1, "jo@pauseai.uk")).toEqual({ ok: false, reason: "gone" });
    expect(await letInByStaff(id + 1, "jo@pauseai.uk")).toEqual({ ok: false, reason: "gone" });
  });

  it("set the community's link, as pasted, logged; and are refused one that isn't an invite link", async () => {
    expect(await communityLink()).toBeUndefined();
    expect(await setCommunityLink("https://example.com/x", "jo@pauseai.uk")).toEqual({
      ok: false,
      reason: "not-a-link",
    });
    expect(await setCommunityLink(` ${LINK}?s=cl `, "jo@pauseai.uk")).toEqual({ ok: true });
    expect(await communityLink()).toMatchObject({ link: LINK, setBy: "jo@pauseai.uk" });
    const [logged] = await query<{ action: string; details: object }>("SELECT action, details FROM audit_log");
    expect(logged).toEqual({ action: "set waiting room link", details: { link: LINK } });
  });

  it("see each state's people with their chats, newest first, and how many are in each", async () => {
    await setLink();
    await asksAndReplies(REASON);
    await receiveWaitingRoomMessage(from(JOIN, { number: "+447700900456", profileName: "" }));
    const { people, counts } = await waitingRoom("let-in");
    expect(counts).toEqual({ held: 0, "let-in": 1, dismissed: 0, asked: 1 });
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ number: JANE, profileName: "Jane", cameFrom: "parents", state: "let-in" });
    expect(people[0].supporterId).toEqual(expect.any(Number));
    expect(people[0].messages.map((message) => [message.ours, message.body])).toEqual([
      [false, JOIN],
      [true, texts.welcome],
      [false, REASON],
      [true, texts.link(LINK)],
    ]);
    expect(await waitingRoomOf(people[0].supporterId!)).toEqual(people[0]);
    expect(await waitingRoomOf(people[0].supporterId! + 1)).toBeUndefined();
    expect((await waitingRoom("asked")).people[0]).toMatchObject({ profileName: "", supporterId: null });
  });

  it("are emailed while anyone is held, at most once a day", async () => {
    expect(await emailHeld()).toBe(false);
    await asksAndReplies("hi");
    expect(await emailHeld()).toBe(true);
    expect(await emailHeld()).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0].Subject).toBe(waitingRoomCopy.heldEmail.subject(1));
    expect(sent[0].TextBody).toContain(
      waitingRoomCopy.heldEmail.body(1, "https://pauseai.uk/staff/supporters/waiting-room"),
    );
  });
});
