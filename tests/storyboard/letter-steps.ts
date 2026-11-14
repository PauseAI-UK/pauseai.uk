// Email your MP, as a supporter goes through it: finding their MP by
// postcode, writing the letter and sending it; and the letter it makes, as
// staff find it. Every step takes the host, so a flow can run against any
// build.
import { expect, type Page } from "@playwright/test";
import { campaigns, copy } from "@/lib/content/email-your-mp";
import { TEST_MPS, type TestMp } from "@/lib/test-mps";
import { runSql } from "@/scripts/fresh-database.mjs";
import { BASE } from "./fixtures";
import { logIn } from "./login-steps";
import { fakeTurnstile } from "./turnstile-steps";

// Redirects to the first campaign.
const TOOL_PAGE = "/campaigns";

/** Opens the tool and fills in the name, Jane Smith unless told otherwise, and a postcode, without looking it up yet. */
export async function openLookup(
  page: Page,
  base: string,
  postcode = "ZZ9 9ZZ",
  path = TOOL_PAGE,
  name = "Jane Smith",
) {
  const response = await page.goto(`${base}${path}`);
  if (!response?.ok()) throw new Error(`${base}${path} returned ${response?.status()}: is the tool deployed there?`);
  await page.waitForLoadState("load");
  // Filling scrolls the field into view; a font that swaps in afterwards
  // moves the page under it, and the frame with it.
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel(copy.lookup.nameLabel).fill(name);
  await page.getByLabel(copy.lookup.addressLabel).fill("1 High Street, Testville");
  await page.getByLabel(copy.lookup.postcodeLabel).fill(postcode);
}

/**
 * Looks up a test MP, ZZ99ZZ unless told otherwise, as `name`, and waits
 * for them and their letter. Fails fast, saying why, rather than waiting out the test's
 * timeout for a field or a heading that will never appear.
 */
export async function lookUpTestMp(page: Page, base: string, mp: TestMp = TEST_MPS[0], name?: string) {
  await openLookup(page, base, `${mp.postcode.slice(0, -3)} ${mp.postcode.slice(-3)}`, undefined, name);
  await page.getByRole("button", { name: copy.lookup.button }).click();

  const found = page.getByRole("heading", { name: mp.name });
  const refused = page.locator("p[role=alert]");
  await found.or(refused).first().waitFor({ timeout: 10_000 });
  if (await refused.isVisible()) {
    throw new Error(
      `${mp.postcode} on ${base} said: "${await refused.textContent()}". Does its database have the test MP?`,
    );
  }
  if (await page.getByText(copy.lookup.noEmail).isVisible()) {
    throw new Error(`The test MP on ${base} has no email, so there's no form: set TEST_MP_EMAIL there.`);
  }
}

/** Fills in the letter form and goes to its preview. Nothing is sent yet. */
export async function fillLetter(page: Page, email: string) {
  await page.getByLabel(copy.form.emailLabel).fill(email);
  await page.getByRole("button", { name: copy.form.preview }).click();
  await page.getByRole("button", { name: copy.preview.send }).waitFor();
}

/** Sends the letter from its preview, and waits for the "sent" page. */
export async function sendLetter(page: Page, mp: TestMp = TEST_MPS[0]) {
  await page.getByRole("button", { name: copy.preview.send }).click();
  await expect(page.getByRole("status")).toHaveText(copy.sent.body(mp.name));
}

/** The ID of the newest letter `sender` wrote, on the flow's `database`. */
export function letterIdOf(database: string, sender: string): string {
  const [id] = runSql(
    database,
    `SELECT s.id FROM letters_from_supporters s JOIN form_entries f ON f.id = s.entry_id
     WHERE f.email = '${sender}' ORDER BY s.id DESC LIMIT 1`,
  );
  return id;
}

/** Writes to `mp` as `sender`, signed `name`, then, logged in, sees it sent, and gives the letter's ID. */
export async function sentLetterId(
  page: Page,
  database: string,
  sender: string,
  mp = TEST_MPS[0],
  name = "Jane Smith",
): Promise<string> {
  await fakeTurnstile(page);
  await lookUpTestMp(page, BASE, mp, name);
  await fillLetter(page, sender);
  await sendLetter(page, mp);
  await page.goto(`${BASE}/staff/campaigns/${campaigns[0].slug}`);
  if (new URL(page.url()).pathname === "/staff/login") await logIn(page, database, ["supporters"]);
  await page.goto(`${BASE}/staff/campaigns/${campaigns[0].slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return letterIdOf(database, sender);
}
