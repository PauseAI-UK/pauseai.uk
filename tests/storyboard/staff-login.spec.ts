import type { Page } from "@playwright/test";
import { ROUTES } from "../routes";
import { stayOnPage } from "./loading-steps";
import { addStaffAccount, logIn, staffEmail } from "./login-steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { FIXTURE_GOOGLE_ACCOUNT_COOKIE } from "@/lib/accounts/session";
import { openBubble, reload } from "./settle";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import type { Section } from "./report/frames";
import { accountsCopy } from "@/app/(staff)/staff/_components/accounts/copy";
import { emailCopy } from "@/app/(staff)/staff/_components/email/copy";
import { shellCopy } from "@/app/(staff)/staff/_components/shell/copy";
import { dashboardCopy } from "@/app/(staff)/staff/_components/dashboard/copy";

export const section: Section = { name: "Logging in, and your account", part: "Staff pages", order: 10 };

// Logging in to the staff pages, and your own account: the dev login,
// logging in with Google, a first login and an admin's accounts, being
// logged out, your Gmail, and the pages kept out of search. Each flow on its
// own database. Here staff log in with Google (logInWithGoogle); the other
// sections use the dev login (logInAsStaff, ./login-steps.ts).

/** Every staff page but the login page. */
const STAFF_PAGES = ROUTES.filter((route) => route.startsWith("/staff") && !route.startsWith("/staff/login"));

/**
 * Logs in on `base` as `email`, as staff do: the fixture build's Google is
 * signed in to `email` (FIXTURE_GOOGLE_ACCOUNT_COOKIE), so the button comes
 * straight back from it as them. Ticks "Keep me signed in" if `keep`.
 */
async function logInWithGoogle(page: Page, base: string, email: string, keep = false) {
  await page.context().addCookies([{ name: FIXTURE_GOOGLE_ACCOUNT_COOKIE, value: email, url: base }]);
  const login = await page.goto(`${base}/staff/login`);
  if (!login?.ok()) throw new Error(`${base}/staff/login returned ${login?.status()}: is the staff interface there?`);
  if (keep) await page.getByRole("checkbox", { name: accountsCopy.login.keep }).check();
  await page.getByRole("button", { name: accountsCopy.login.button }).click();
}

test("The dev login", async ({ page, flowDatabase }) => {
  story(
    "On a development build, the login page has a box under the card for signing in at once as any staff account. It never appears on the real site.",
  );
  addStaffAccount(flowDatabase, "jo@pauseai.uk", ["supporters"]);
  await page.goto(`${BASE}/staff/login`);
  const dev = page.getByRole("region", { name: accountsCopy.devLogin.title });
  await expect(dev.getByRole("button", { name: "admin@pauseai.uk" })).toBeVisible();
  await frame(page, "The login page");
  story("Jo, who has the Supporters permission, signs in with one click.");
  await dev.getByRole("button", { name: "jo@pauseai.uk" }).click();
  await expect(page).toHaveURL(`${BASE}/staff`);
  await expect(page.getByText("jo@pauseai.uk").first()).toBeAttached();
  await frame(page, "The dashboard, as Jo");
});

test("Every page asks you to log in", async ({ request }) => {
  story("Logged out, every staff page sends you to the login page, which remembers the page you wanted.");
  expect(STAFF_PAGES.length).toBeGreaterThan(4);
  for (const route of STAFF_PAGES) {
    const res = await request.get(`${BASE}${route}`, { maxRedirects: 0 });
    expect(res.status(), route).toBe(307);
    const back = route === "/staff" ? "" : `?next=${encodeURIComponent(route)}`;
    const location = new URL(res.headers().location, BASE);
    expect(location.pathname + location.search, route).toBe(`/staff/login${back}`);
  }
});

test("Logged out, nothing changes", async ({ request }) => {
  story("Logged out, nothing on the staff pages can be changed, and a forged login doesn't get in.");
  const logout = await request.post(`${BASE}/staff/api/logout`, { maxRedirects: 0 });
  expect(logout.status()).toBe(401);

  // A Server Action is a POST to the page, naming the action in a header.
  const action = await request.post(`${BASE}/staff/politicians`, {
    headers: { "Next-Action": "0000000000000000000000000000000000000000" },
    multipart: { politicianId: "1", ask: "frontier-ai-letter", status: "signed" },
    maxRedirects: 0,
  });
  expect(action.status()).toBe(307);
  expect(action.headers().location).toMatch(/\/staff\/login\?next=%2Fstaff%2Fpoliticians$/);

  // With a made-up cookie the proxy lets it through, and requireStaff() turns it away.
  const forged = await request.get(`${BASE}/staff`, { headers: { cookie: "staff_session=made-up" }, maxRedirects: 0 });
  expect(forged.status()).toBe(307);
});

test("A Google account outside pauseai.uk", { tag: "@phone" }, async ({ page }) => {
  story("Someone signs in with Google, choosing an account outside pauseai.uk.");
  await page.goto(`${BASE}/staff/login`);
  await frame(page, "The login page");
  await logInWithGoogle(page, BASE, "someone@gmail.com");
  await expect(page).toHaveURL(`${BASE}/staff/login?other=1`);
  await expect(page.getByText(accountsCopy.login.other)).toBeVisible();
  await frame(page, "Back from Google, not let in");
  story("They're back on the login page, which says only pauseai.uk accounts can sign in.");
});

test("Logging in with Google", async ({ page, flowDatabase }) => {
  story("Staff tick Keep me signed in, and sign in with their pauseai.uk Google account.");
  const email = staffEmail();
  addStaffAccount(flowDatabase, email);
  await logInWithGoogle(page, BASE, email, true);
  story("Back from Google, they're logged in, for 30 days as they ticked the box.");
  await expect(page).toHaveURL(`${BASE}/staff`);
  // Who's logged in is in the header (behind the menu on a phone).
  await expect(page.getByText(email).first()).toBeAttached();
  const session = (await page.context().cookies()).find((c) => c.name === "staff_session")!;
  expect(session.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 86_400);
  await frame(page, "Logged in");
  story(
    "Coming back from Google to a browser that didn't start the login logs nobody in, and the page says it didn't work.",
  );
  await page.context().clearCookies({ name: "staff_session" });
  await page.goto(`${BASE}/staff/api/google/callback?code=fixture:${email}&state=made-up`);
  await expect(page).toHaveURL(`${BASE}/staff/login?failed=1`);
  await expect(page.getByText(accountsCopy.login.failed)).toBeVisible();
  await frame(page, "Signing in didn't work");
});

test("Staff accounts", async ({ page, flowDatabase }, testInfo) => {
  story(
    "Someone logs in for the first time. An account is made for them, with no permissions, so they see the dashboard and the pages any account opens, but not the admin's.",
  );
  const colleague = `colleague-${testInfo.testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;
  // Logged in for the first time, with no account: one is made, with no permissions, so the dashboard and the pages any account opens.
  await logInWithGoogle(page, BASE, staffEmail());
  // The sidebar has a heading of the same name, before the dashboard's.
  await expect(page.getByRole("heading", { level: 2, name: shellCopy.nav.sections.politicians }).last()).toBeVisible();
  // The sidebar (hidden behind the bar's menu on a phone, so read from the DOM) offers the ordinary pages and not the admin's.
  await expect(page.locator('nav a[href="/staff/politicians"]').first()).toBeAttached();
  await expect(page.locator('nav a[href="/staff/accounts"]')).toHaveCount(0);
  await frame(page, "The dashboard, after a first login");
  story("The dashboard can show the last 30 days instead.");
  // The dashboard over a longer window, from the links under the day.
  await page.getByRole("link", { name: dashboardCopy.home.dashboard.window(30) }).click();
  await expect(page).toHaveURL(`${BASE}/staff?days=30`);
  await expect(page.getByText(dashboardCopy.home.dashboard.change.same(30)).first()).toBeVisible();
  await frame(page, "The dashboard, over 30 days");
  story("Without the Admin permission, the staff accounts page sends them back to the dashboard.");
  await page.goto(`${BASE}/staff/accounts`);
  await expect(page).toHaveURL(`${BASE}/staff`);

  // As an admin: the accounts page, where a colleague is added, given a permission, and removed.
  story("Given the Admin permission, they can open the staff accounts page.");
  addStaffAccount(flowDatabase, staffEmail(), ["admin"]);
  await page.goto(`${BASE}/staff/accounts`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(accountsCopy.accounts.title);
  await frame(page, "The staff accounts page");
  story("Their name is beside their address, as Google gave it when they logged in.");
  await expect(page.getByRole("row").filter({ hasText: staffEmail() }).getByRole("cell").nth(1)).toHaveText(
    `Staff ${staffEmail().split("@")[0].slice(6)}`,
  );
  story("Add staff asks for a colleague's address.");
  // Added from Add staff, at the top right, at once: an account with no permissions.
  await openBubble(page.getByRole("button", { name: accountsCopy.accounts.addStaff }));
  await page.getByRole("textbox", { name: accountsCopy.accounts.addLabel }).fill(colleague);
  await frame(page, "Add staff");
  story("Added, the colleague has an account with no permissions.");
  await page.getByRole("button", { name: accountsCopy.accounts.add, exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: colleague });
  await expect(row).toContainText(staffEmail());
  await frame(page, "The colleague, added");
  story("Edit shows a box for each permission. They tick Supporters, and save.");

  // Edit opens a box for each; Save saves those ticked: still there after a reload.
  await openBubble(row.getByRole("button", { name: accountsCopy.accounts.edit }));
  const permissions = page.getByRole("form", { name: accountsCopy.accounts.editLabel(colleague) });
  await permissions.getByRole("checkbox", { name: accountsCopy.accounts.names.supporters }).check();
  await frame(page, "The colleague's permissions");
  story("After a reload, the colleague has the Supporters permission.");
  await permissions.getByRole("button", { name: accountsCopy.accounts.save }).click();
  await expect(permissions).not.toBeVisible();
  await reload(page);
  await expect(row.getByRole("cell").nth(2)).toContainText(accountsCopy.accounts.names.supporters);
  await frame(page, "The colleague, with Supporters");
  story("Remove asks to be confirmed.");

  await row.getByRole("button", { name: accountsCopy.accounts.remove }).click();
  await frame(page, "Remove, pressed once");
  story(
    "Confirmed, the colleague is gone. A note says they can still log in with basic permissions, unless their Gmail is disabled too.",
  );
  await row.getByRole("button", { name: staffVocabulary.deleteItShort }).click();
  await expect(page.getByRole("row").filter({ hasText: colleague })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(accountsCopy.accounts.removeNote);
  await frame(page, "The colleague, removed");
  story("The audit log shows the account the first login made, then the colleague added and removed.");

  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByRole("cell", { name: "add staff account" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "remove staff account" })).toBeVisible();
  // The first login's account, added by the login itself.
  await expect(
    page.getByRole("row").filter({ hasText: "add staff account" }).filter({ hasText: staffEmail() }).first(),
  ).toBeVisible();
  await frame(page, "The audit log");
});

test("Connecting your Gmail", async ({ page, flowDatabase }) => {
  story(
    "Staff open their own page from their address in the sidebar. It says their Gmail isn't connected, what connecting it means, and where they're logged in.",
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff`);
  // Your address in the navigation leads to your page (on a phone, inside the menu).
  await expect(page.locator('nav a[href="/staff/me"]').first()).toHaveText(staffEmail());
  await page.goto(`${BASE}/staff/me`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(accountsCopy.me.title);
  await expect(page.getByRole("link", { name: emailCopy.gmail.connect })).toBeVisible();
  await frame(page, "Your account");
  story("Connect Gmail greys, with a spinner, while Google's page comes.");

  // Google's page kept from coming, so the button can be seen waiting for it.
  const google = await stayOnPage(page, /\/staff\/api\/gmail\/connect/);
  const connect = page.getByRole("link", { name: emailCopy.gmail.connect });
  await connect.click();
  // Its spinner shows once it has taken a moment.
  await expect(connect.locator("[aria-hidden]")).toBeVisible();
  await frame(page, "Connect Gmail, waiting");
  story(
    "Back from Google, their Gmail is connected. The page says how many emails it has sent today, with Disconnect Gmail.",
  );
  await page.goto(await google.asked());
  await expect(page.getByText(emailCopy.gmail.outcomes.connected)).toBeVisible();
  await expect(page.getByRole("button", { name: emailCopy.gmail.disconnect })).toBeVisible();
  await frame(page, "Gmail connected");
  story("Disconnect Gmail disconnects it, and the page says so.");

  await page.getByRole("button", { name: emailCopy.gmail.disconnect }).click();
  await expect(page.getByText(emailCopy.gmail.outcomes.disconnected)).toBeVisible();
  await expect(page.getByText(emailCopy.gmail.outcomes.connected)).toHaveCount(0);
  await expect(page.getByRole("link", { name: emailCopy.gmail.connect })).toBeVisible();
  await frame(page, "Gmail disconnected");
  story("If they choose a Google account other than their staff address, the page says which to choose.");

  // Google sending you back having chosen another account, as the callback does.
  await page.goto(`${BASE}/staff/me?gmail=other-account`);
  await expect(page.getByText(emailCopy.gmail.otherAccount(staffEmail()))).toBeVisible();
  await frame(page, "The wrong Google account");
});

test("Kept out of search", async ({ page, request }) => {
  story("Search engines are told not to list the staff pages, and the sitemap leaves them out.");
  await page.goto(`${BASE}/staff/login`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await (await request.get(`${BASE}/sitemap.xml`)).text()).not.toContain("/staff");
});
