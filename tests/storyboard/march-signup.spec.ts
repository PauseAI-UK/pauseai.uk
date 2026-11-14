import type { Locator, Page } from "@playwright/test";
import { marchSignupCopy as copy } from "@/lib/content/march-signup";
import { BASE, expect, madeUpAddress, frame, story, test } from "./fixtures";
import { hydrated, layoutSettled, scrollSettled } from "./settle";
import type { Section } from "./report/frames";

export const section: Section = { name: "March sign-up", part: "Public site", order: 40 };

// The march sign-up (app/(march)/): the site's header, without the march
// banner; the marks drawn in marker pen; the form, which adds the person to
// the Luma event; and the card it turns into, in place: the share card.

const header = (page: Page) => page.getByRole("banner");
/** The share card's confirmation, where focus lands after registering. */
const registered = (page: Page) => page.locator("[data-focus-first]", { hasText: copy.share.registered });

type DataLayerWindow = Window & { dataLayer?: ArrayLike<unknown>[] };

/**
 * The events the page has sent to GA through gtag, read off the dataLayer, where
 * CookieConsent's gtag pushes every command.
 */
function marchEvents(page: Page) {
  return page.evaluate(() =>
    ((window as DataLayerWindow).dataLayer ?? [])
      .map((entry) => Array.from(entry))
      .filter(([command]) => command === "event"),
  );
}

async function openSignup(page: Page) {
  await page.goto(`${BASE}/protests/march-against-ai-extinction-nov-26`);
  await hydrated(page);
  await layoutSettled(page, "main");
}

/**
 * Every marker-pen mark drawn: each is drawn as its words scroll into view,
 * so each is brought into view in turn until it has been, then the page goes
 * back to the top.
 */
async function allMarked(page: Page) {
  const marks = page.locator("svg.rough-annotation");
  await expect(marks).toHaveCount(7);
  for (const mark of await marks.all()) {
    await mark.evaluate((svg) => svg.parentElement!.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(mark.locator("path").first()).toBeAttached();
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await scrollSettled(page);
}

/** A new card's title, scrolled to the top of the window but clear of the header. */
async function expectBelowHeader(page: Page, title: Locator) {
  const bar = (await header(page).boundingBox())!;
  const top = (await title.boundingBox())!.y;
  expect(top).toBeGreaterThanOrEqual(bar.y + bar.height);
  expect(top).toBeLessThan(page.viewportSize()!.height / 2);
}

/** Fills in the form at the foot of the page, reached by the hero's button. */
async function fillIn(page: Page, email: string) {
  await page.getByRole("link", { name: "Register now" }).click();
  await scrollSettled(page);
  await page.getByLabel(copy.form.name).fill("Testy McTestface");
  await page.getByLabel(copy.form.email).fill(email);
}

/**
 * The form's top at the top of the window, under the header. Typing in a field
 * scrolls it into view, which leaves the window a few pixels apart between runs;
 * and the page's scroll-padding is the header's height only once the header has
 * measured itself, so the form is placed by the header's own height, as the
 * scroll-padding puts it (styles/base.css), not by scrollIntoView.
 */
async function formAtTop(page: Page): Promise<void> {
  const form = page.locator("form");
  // Placed again until it stays: the page can still shift a few pixels once it's placed.
  await expect(async () => {
    const clearance = await form.evaluate((el) => {
      const below = document.querySelector("header")!.offsetHeight + 13;
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - below, behavior: "instant" });
      return below;
    });
    await scrollSettled(page);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(await form.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(clearance);
  }).toPass();
}

/**
 * The form's message, mid-window. A click leaves the window wherever
 * scrolling the button into view put it, which varies between runs.
 */
async function messageMidWindow(page: Page): Promise<void> {
  const alert = page.locator("form").getByRole("alert");
  await alert.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await scrollSettled(page);
  await expect(alert).toBeInViewport();
}

/**
 * The share card's Copy button, mid-window, the apps above it. Pressing it
 * leaves the window wherever scrolling it into view put it: Playwright tries
 * the middle of the window, then its foot, then its top, moving on each time
 * a press doesn't land, so which it ends on varies between runs.
 */
async function copyMidWindow(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: copy.share.copy });
  await button.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await scrollSettled(page);
  await expect(button).toBeInViewport({ ratio: 1 });
}

test("Registering for the march", { tag: "@phone" }, async ({ page }) => {
  story(
    "Someone opens the march page, under the site's own header but without the march banner, as this is the page it points to. Headings and the march's demand are highlighted in orange, and key words underlined, as with a marker pen.",
  );
  await openSignup(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("March Against AI Extinction");
  await expect(header(page)).toBeInViewport();
  await expect(page.getByRole("complementary", { name: "March Against AI Extinction" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await allMarked(page);
  await frame(page, "The march page");
  story("They press Register now, which takes them to the form at the foot of the page, and fill it in.");

  await fillIn(page, madeUpAddress("Testy McTestface", 43, "example.org"));
  await formAtTop(page);
  await expect(header(page)).toBeInViewport();
  await expect(page.locator("form").getByText(copy.form.head, { exact: true })).toBeInViewport();
  await frame(page, "The form, filled in");
  story("They press Register. The form turns into the share card, which says they're registered, with their email.");

  await page.getByRole("button", { name: copy.form.submit, exact: true }).click();
  const confirmation = registered(page);
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toContainText(madeUpAddress("Testy McTestface", 43, "example.org"));
  await expect(page).toHaveURL(`${BASE}/protests/march-against-ai-extinction-nov-26#register`);
  await expect(page.getByRole("link", { name: copy.share.impact.link })).toBeVisible();
  await scrollSettled(page);
  await expectBelowHeader(page, confirmation);
  await frame(page, "The share card");
});

test("Registration fails", { tag: "@phone" }, async ({ page }) => {
  story(
    "Someone registers, but their registration doesn't reach the march's event on Luma. The form says so, and links to the Luma event page to register there instead.",
  );
  await openSignup(page);
  await fillIn(page, "luma-fails@example.org");
  await page.getByRole("button", { name: copy.form.submit, exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(copy.form.failed);
  await expect(page.getByRole("link", { name: copy.form.lumaFallback })).toHaveAttribute(
    "href",
    "https://luma.com/pauseai-nov26",
  );
  await expect(page).toHaveURL(`${BASE}/protests/march-against-ai-extinction-nov-26#register`);
  await messageMidWindow(page);
  await frame(page, "The form's message");
});

test("An invalid email address", async ({ page }) => {
  story("Someone registers with an email address that can't be right. The form asks for a valid one.");
  await openSignup(page);
  await fillIn(page, "testy@example");
  await page.getByRole("button", { name: copy.form.submit, exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.emailInvalid);
  await messageMidWindow(page);
  await frame(page, "The form's message");
});

test("How many have registered", { tag: "@phone" }, async ({ page }) => {
  story("The march page says how many people have registered so far, under the Register now button.");
  await openSignup(page);
  // The fixture event's approved guests, under the hero's buttons.
  const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1 }) });
  const going = "Join 1,234+ people already registered";
  // On a phone the photo takes the top of the screen, so the count is just below it.
  await hero.getByText(going).scrollIntoViewIfNeeded();
  await scrollSettled(page);
  await expect(hero.getByText(going)).toBeInViewport();
  await frame(page, "The count under the buttons", { window: true });
  story("The form shows the same count in its corner.");

  await page.getByRole("link", { name: "Register now" }).click();
  await scrollSettled(page);
  const form = page.locator("form");
  await expect(form).toContainText(`1,234 ${copy.form.count}`);
  await frame(page, "The count on the form");
  story("When someone comes back to the page from another tab, it gets the latest count at once.");

  // Coming back to the page asks the count's endpoint again, at once.
  const asked = page.waitForResponse((res) => res.url().endsWith("/api/march/signups") && res.ok());
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(await (await asked).json()).toEqual({ count: 1234 });
  await expect(form).toContainText(`1,234 ${copy.form.count}`);
  await expect(hero).toContainText(going);
});

test("The march page in a wide window", { tag: "@desktop-only" }, async ({ page }) => {
  story(
    "Someone opens the march page in a window 1920 pixels wide. The hero's words start near the window's edge, clear of the woman with the sign, who stands in the middle of the window's right half.",
  );
  const left = async (locator: Locator) => Math.round((await locator.boundingBox())!.x);
  const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1 }) });
  const words = page.getByRole("heading", { level: 1 });
  /**
   * Where the woman with the sign stands: 56% of the way across the photo.
   * The photo is decorative, so it has no role to find it by.
   */
  const woman = async () => {
    const photo = (await hero.locator('img[src*="hero-march"]').boundingBox())!;
    return Math.round(photo.x + photo.width * 0.56);
  };
  await page.setViewportSize({ width: 1920, height: 800 });
  await openSignup(page);
  const box = (await hero.boundingBox())!;
  expect(await left(words)).toBe(Math.round(box.x) + 80);
  expect(await woman()).toBe(Math.round(box.x + box.width * 0.75));
  await frame(page, "The top of the page, in a window 1920 pixels wide", { window: true });
  story(
    "They make the window wider still. Past 1920 pixels the words start in line with the site's logo above them and the page below, and the photo keeps its place beside them.",
  );

  await page.setViewportSize({ width: 2560, height: 800 });
  await layoutSettled(page, "main");
  const edge = await left(words);
  expect(edge).toBe(await left(header(page).getByRole("link", { name: "PauseAI UK" })));
  expect(edge).toBe(await left(page.getByRole("heading", { level: 2 }).first()));
  expect((await woman()) - edge).toBe(1000);
  await frame(page, "The top of the page, in a window 2560 pixels wide", { window: true });
});

test("Seeing all the details", { tag: "@phone" }, async ({ page }) => {
  story("Someone presses See all details in the hero. The page moves down to what happens on the day.");
  await openSignup(page);
  await page.getByRole("link", { name: "See all details" }).click();
  await scrollSettled(page);
  await expect(page.getByRole("heading", { name: "On the day" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Downing Street" })).toBeInViewport();
  await frame(page, "On the day");
});

test("What we want, highlighted", { tag: "@phone" }, async ({ page }) => {
  story(
    "Someone scrolls down to what we want. As its heading comes into view, an orange highlighter sweeps in behind it, from the left.",
  );
  await openSignup(page);
  const heading = page.getByRole("heading", { name: "What we want" });
  await heading.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await scrollSettled(page);
  await expect(heading.locator("svg.rough-annotation path")).toHaveCount(1);
  await frame(page, "What we want, highlighted", { window: true });
});

test("Sharing, and registering someone new", { tag: "@phone" }, async ({ page, context }) => {
  story(
    "After registering, someone copies the share card's message to send to friends. The button says it's copied, and we count the registration and the share in our analytics. On a computer every app to share to shows, on two lines; on a phone they're one row to swipe along.",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openSignup(page);
  await fillIn(page, "testy@example.org");
  await page.getByRole("button", { name: copy.form.submit, exact: true }).click();
  await expect(registered(page)).toBeFocused();
  // The card glides into place first: pressing Copy mid-glide would scroll the
  // button into view and stop the page wherever the glide had got to.
  await scrollSettled(page);

  await page.getByRole("button", { name: copy.share.copy }).click();
  await expect(page.getByRole("button", { name: copy.share.copied })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copy.share.message);
  expect(await marchEvents(page)).toEqual([
    ["event", "march_signup", {}],
    ["event", "march_share", { share_method: "copy" }],
  ]);
  await page.getByRole("button", { name: copy.share.copy }).waitFor();
  await copyMidWindow(page);
  // A mouse can't swipe the row, so there the apps wrap and all show; a
  // phone's row runs off its end, faded.
  const apps = page.getByRole("list").filter({ has: page.getByRole("link", { name: "WhatsApp", exact: true }) });
  await expect(apps.getByRole("link")).toHaveCount(9);
  if (test.info().project.name === "desktop") {
    for (const app of await apps.getByRole("link").all()) await expect(app).toBeInViewport({ ratio: 1 });
  } else {
    await expect(apps).toHaveAttribute("data-fade", "end");
    await expect(apps.getByRole("link", { name: "Email" })).not.toBeInViewport();
  }
  await frame(page, "The message, copied");
  story("Then they press Register someone new. The form comes back empty, ready for the next person.");

  await page.getByRole("button", { name: copy.share.registerAnother }).click();
  await expect(page.getByLabel(copy.form.name)).toBeFocused();
  await expect(page.getByLabel(copy.form.email)).toHaveValue("");
  await scrollSettled(page);
  await frame(page, "The form, empty");
});
