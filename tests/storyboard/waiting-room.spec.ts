import type { APIRequestContext, Page } from "@playwright/test";
import { waitingRoomJoinCopy } from "@/lib/content/whatsapp";
import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import { FIXTURE_NOW } from "@/lib/server/fixtures/fixture-env.mjs";
import { runSql } from "@/scripts/fresh-database.mjs";
import { postWhatsAppWebhook } from "../whatsapp-webhooks";
import { logIn } from "./login-steps";
import { fakeTurnstile } from "./turnstile-steps";
import { newestText, OUR_CHAT, textFrame } from "./whatsapp-steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { hydrated } from "./settle";
import type { Section } from "./report/frames";

export const section: Section = { name: "The WhatsApp waiting room", part: "Public site", order: 45 };

// The WhatsApp waiting room (docs/domain-concepts.md, "The waiting room"):
// asking to join at /whatsapp/beta, then the chat with our number, as
// WhatsApp's webhook brings each message, which the fake Claude checks
// (lib/server/fixtures/fakes/anthropic.ts: a reply of four words or more
// passes, a shorter one or one with a link is held); and the staff page,
// where those held are let in or dismissed, and the community's link set.
// Each flow's person has a number of their own, and a flow that sends the
// community's link sets one first, as staff would.

const page = waitingRoomCopy.page;
const texts = waitingRoomCopy.texts;

let messages = 0;
/** A message to our number from `number` (digits alone), named `name` in WhatsApp, `minutes` from the clock: before it, so ours, sent at its time, come after. */
async function messageUs(request: APIRequestContext, number: string, name: string, words: string, minutes: number) {
  await postWhatsAppWebhook(request, BASE, {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "fixture-account",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "447700900000", phone_number_id: "fixture-phone" },
              contacts: [{ wa_id: number, profile: { name } }],
              messages: [
                {
                  from: number,
                  id: `wamid.waiting-${number}-${++messages}`,
                  timestamp: String(Math.floor(Date.parse(FIXTURE_NOW) / 1000) + minutes * 60),
                  type: "text",
                  text: { body: words },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

/** The community's link, as a staff member set it a while ago. */
const LINK = "https://chat.whatsapp.com/FixtureInvite";
function linkSet(database: string) {
  runSql(
    database,
    `INSERT INTO waiting_room_links (link, set_by, set_at) VALUES ('${LINK}', 'jo@pauseai.uk', now() - interval '20 days')`,
  );
}

/** The newest words our number sent `number` (+447…). */
function ourNewest(number: string): string {
  const text = newestText(number);
  if (!text || !("words" in text)) throw new Error(`Nothing of ours went to ${number}`);
  return text.words;
}

/** The waiting room's staff page, on tab `show`. */
async function openWaitingRoom(staffPage: Page, show?: string) {
  await staffPage.goto(`${BASE}/staff/supporters/waiting-room${show ? `?show=${show}` : ""}`);
  await hydrated(staffPage);
}

test("Asking to join on WhatsApp", { tag: "@phone" }, async ({ page: browser }) => {
  story("Someone on the Parents page wants to join our WhatsApp community. The page asks them to pass the spam check.");
  await fakeTurnstile(browser);
  await browser.goto(`${BASE}/whatsapp/beta?utm_source=parents`);
  await hydrated(browser);
  story(
    "Past it, the button opens WhatsApp with a message to our number typed for them, saying they came from Parents.",
  );
  const button = browser.getByRole("link", { name: waitingRoomJoinCopy.button });
  await expect(button).toHaveAttribute("href", /^https:\/\/wa\.me\/447700900000\?text=.*\(parents\)$/);
  await frame(browser, "The button to message us");
});

test("Let in by the check", async ({ page: browser, request, flowDatabase }) => {
  linkSet(flowDatabase);
  story("Jane sends the message the button typed. Our number welcomes her and asks why she's interested.");
  await messageUs(request, "447700900321", "Jane", "Hi PauseAI UK, I'd like to join (parents)", -10);
  await expect.poll(() => newestText("+447700900321")).toBeTruthy();
  await textFrame(browser, OUR_CHAT, { words: ourNewest("+447700900321") }, "Our number's welcome");
  story("She says why, with her postcode. The check reads it as a real person's, so the community's link goes to her.");
  await messageUs(request, "447700900321", "Jane", "I'm a parent worried about AI and my kids. LS6 1AA", -8);
  await expect.poll(() => ourNewest("+447700900321")).toContain(LINK);
  await textFrame(browser, OUR_CHAT, { words: ourNewest("+447700900321") }, "The link to the community");
  story("Staff see her among those let in, with the whole chat, and she's a supporter, the chat on her page too.");
  await logIn(browser, flowDatabase, ["supporters"]);
  await openWaitingRoom(browser, "let-in");
  const jane = browser.getByRole("region", { name: "Jane" });
  await expect(jane.getByText("I'm a parent worried about AI")).toBeVisible();
  await frame(browser, "Let in by the check");
  await jane.getByRole("link", { name: page.supporter }).click();
  await expect(browser.getByRole("region", { name: page.chat })).toBeVisible();
  await hydrated(browser);
  await frame(browser, "Her supporter page, with the chat");
});

test("Held, then let in by staff", async ({ page: browser, request, flowDatabase }) => {
  linkSet(flowDatabase);
  story('Alex asks to join, then answers only "hi". The check holds that for a person.');
  await messageUs(request, "447700900322", "Alex", "Hi PauseAI UK, I'd like to join (footer)", -15);
  await messageUs(request, "447700900322", "Alex", "hi", -12);
  story("Alex writes again. Our number says, once, that someone will check.");
  await messageUs(request, "447700900322", "Alex", "hello? I want to help with the campaign", -5);
  await expect.poll(() => ourNewest("+447700900322")).toBe(texts.checking);
  await textFrame(browser, OUR_CHAT, { words: ourNewest("+447700900322") }, "We'll check");
  story("Staff find Alex held, with why, and the second message that makes the case. They let Alex in.");
  await logIn(browser, flowDatabase, ["supporters"]);
  await openWaitingRoom(browser);
  const alex = browser.getByRole("region", { name: "Alex" });
  await expect(alex.getByText("It gives no reason for joining.")).toBeVisible();
  await frame(browser, "Held, with why");
  await alex.getByRole("button", { name: page.letIn }).click();
  await expect(browser.getByRole("region", { name: "Alex" })).toHaveCount(0);
  story("The link goes to Alex, who's now among those let in, by the staff member.");
  await expect.poll(() => ourNewest("+447700900322")).toContain(LINK);
  await openWaitingRoom(browser, "let-in");
  await expect(browser.getByRole("region", { name: "Alex" })).toBeVisible();
  await frame(browser, "Let in by staff");
});

test("Dismissing an advert", async ({ page: browser, request, flowDatabase }) => {
  story("An investment club asks to join, and answers with an advert. The check holds it.");
  await messageUs(request, "447700900323", "Gains Club", "join (site)", -10);
  await messageUs(request, "447700900323", "Gains Club", "Our club: https://chat.whatsapp.com/AbC123", -8);
  await logIn(browser, flowDatabase, ["supporters"]);
  await openWaitingRoom(browser);
  const club = browser.getByRole("region", { name: "Gains Club" });
  await expect(club.getByText("It's an advert with a link.")).toBeVisible();
  story("Staff dismiss it, for good. It's among those dismissed, and nothing more goes to it.");
  await club.getByRole("button", { name: page.dismiss }).click();
  await expect(browser.getByRole("region", { name: "Gains Club" })).toHaveCount(0);
  await openWaitingRoom(browser, "dismissed");
  await expect(browser.getByRole("region", { name: "Gains Club" })).toBeVisible();
  await frame(browser, "Dismissed");
});

test("Changing the community's link", async ({ page: browser, flowDatabase }) => {
  story(
    "The community's link has been seen in public, so a staff member resets it in WhatsApp and pastes the new one.",
  );
  await logIn(browser, flowDatabase, ["supporters"]);
  await openWaitingRoom(browser);
  const field = browser.getByRole("textbox", { name: page.link.label });
  await field.fill("https://example.com/not-a-link");
  await browser.getByRole("button", { name: page.link.save }).click();
  await expect(browser.getByText(page.refused["not-a-link"])).toBeVisible();
  await frame(browser, "A link that isn't one");
  await field.fill("https://chat.whatsapp.com/NewFixtureInvite?s=cl");
  await browser.getByRole("button", { name: page.link.save }).click();
  await expect(browser.getByText("https://chat.whatsapp.com/NewFixtureInvite", { exact: true })).toBeVisible();
  await frame(browser, "The new link, and who set it");
});
