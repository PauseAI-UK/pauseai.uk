import type { Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { runSql } from "@/scripts/fresh-database.mjs";
import { NOTIFICATION_INBOX } from "@/tests/fixture-env.mjs";
import { addStaffAccount, importLuma, logInAsStaff, newestEmail } from "../steps";
import { BASE, emailFrame, expect, frame, story, test } from "./fixtures";

// The events page: our Luma events, to come and past, a table each, and
// who on staff owns each. The Luma import gives events their owners by the rules, and
// emails them; one whose owner by the rules has no account has none, an
// error, until someone is chosen for it, who's emailed too; an event's
// Google Doc linked; and, for staff who see supporters, each event's hosts.

const copy = staffCopy.events;

/** This flow's own staff address: flows run alongside each other, and share the outbox. */
const staffEmail = () => `events-${test.info().testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;

async function logIn(page: Page, database: string, permissions: string[] = []) {
  addStaffAccount(database, staffEmail(), permissions);
  return logInAsStaff(page, BASE, staffEmail());
}

test("Event owners", async ({ page, request, flowDatabase }) => {
  story(
    "After the hourly Luma import, every event to come with no owner is given one on staff, by the rules. Joseph has a staff account, and is given every event but the Oxford talk, with an email listing them.",
  );
  // Joseph has an account, so the import gives him every event but Oxford's; Sean, Oxford's by the rules, has none yet.
  addStaffAccount(flowDatabase, "joseph@pauseai.uk");
  await importLuma(request, BASE);
  const josephs = newestEmail((one) => one.To === "joseph@pauseai.uk")!;
  expect(josephs.TextBody).toContain("PauseAI Scotland Meeting");
  expect(josephs.TextBody).not.toContain("AI risk talk");
  await emailFrame(page, josephs, "The email Joseph gets");

  story(
    "The rules give the Oxford talk to Sean, who had no account then, so it has no owner. The events page shows that in red.",
  );
  addStaffAccount(flowDatabase, "sean@pauseai.uk");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.title);
  await expect(page.getByRole("link", { name: copy.source.link })).toHaveAttribute("href", "/staff/import-data/luma");
  const talk = page.getByRole("row").filter({ hasText: "AI risk talk" });
  await expect(talk.getByRole("cell").nth(5).getByText(copy.noOwner)).toBeVisible();
  await frame(page, "The events to come");
  story("Sean has an account now. Staff edit the talk, choose Sean as its owner and paste in its Google Doc.");

  await talk.getByRole("button", { name: copy.edit }).click();
  const form = page.getByRole("form", { name: copy.editLabel("AI risk talk") });
  await expect(form.getByRole("button", { name: copy.save })).toBeDisabled();
  await form.getByLabel(copy.owner).selectOption("sean@pauseai.uk");
  await form.getByLabel(copy.docField).fill("https://docs.google.com/document/d/oxford-talk-plan/edit");
  await frame(page, "The Oxford talk, being edited");
  story("Once saved, Sean owns the talk and its doc is linked, so neither is in red. The page says Sean was emailed.");

  await form.getByRole("button", { name: copy.save }).click();
  await expect(form).not.toBeVisible();
  await expect(talk.getByRole("cell").nth(5).getByText("sean@pauseai.uk")).toBeVisible();
  await expect(talk.getByRole("link", { name: copy.doc })).toHaveAttribute(
    "href",
    "https://docs.google.com/document/d/oxford-talk-plan/edit",
  );
  await expect(page.getByRole("status")).toContainText(copy.emailed(["sean@pauseai.uk"], "sean@pauseai.uk"));
  await frame(page, "The Oxford talk, saved");
  story("Sean's email says they own the talk, and who chose them.");

  // Both viewports' flows email Sean: this one's names its own address.
  const seans = newestEmail((one) => one.To === "sean@pauseai.uk" && one.TextBody.includes(staffEmail()))!;
  expect(seans.TextBody).toContain("AI risk talk");
  await emailFrame(page, seans, "The email Sean gets");
});

test("Tagging new events on Luma", async ({ page, request, flowDatabase }) => {
  story(
    "The first import copies the calendar. Then two new events appear on Luma with no tags: one in Oxford, and one in Tunbridge Wells, where no tag fits.",
  );
  await importLuma(request, BASE);
  const unclear = "Kent flyering";
  runSql(
    flowDatabase,
    `INSERT INTO luma_events (id, name, url, start_at, access, city, region, location_type) VALUES
       ('evt-new-oxford', 'Pub social in the city', 'https://luma.com/new-oxford', '2026-11-20T18:00:00Z', 'manage', 'Oxford', 'England', 'offline'),
       ('evt-new-kent', '${unclear}', 'https://luma.com/new-kent', '2026-11-21T10:00:00Z', 'manage', 'Tunbridge Wells', 'England', 'offline')`,
  );

  story("The next import gives the Oxford event its tag on Luma, as its city says which.");
  await importLuma(request, BASE);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events`);
  const oxford = page.getByRole("row").filter({ hasText: "Pub social in the city" });
  await expect(oxford.getByText("Oxford", { exact: true }).last()).toBeVisible();
  await frame(page, "The new events, one tagged");

  story("It doesn't make a new tag for the other. The notification inbox is asked to look at it, once.");
  const asked = newestEmail((one) => one.Subject === copy.unclearTagEmail.subject(unclear))!;
  expect(asked.To).toBe(NOTIFICATION_INBOX);
  await emailFrame(page, asked, "The email asking about the other");
});

test("Past events", async ({ page, request, flowDatabase }) => {
  story(
    "The Past tab lists events that have happened, latest first. What they lacked, an owner or a doc, is only said, not in red.",
  );
  await importLuma(request, BASE);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events`);
  await page.getByRole("link", { name: copy.tabs.past }).click();
  await expect(page).toHaveURL(`${BASE}/staff/events?when=past`);
  const names = page.locator("tbody tr td:nth-child(2) a");
  await expect(names).toHaveText(["PauseAI London March", "Glasgow street stall"]);
  await frame(page, "Past events");

  story("Staff sort them by how many went, most first, then search for Glasgow. They stay on the Past tab.");
  await page.locator("thead th").filter({ hasText: copy.columns.going }).getByRole("link").click();
  await expect(page).toHaveURL(`${BASE}/staff/events?when=past&sort=going&dir=desc`);
  await frame(page, "Past events, by how many went");

  await page.getByRole("searchbox", { name: copy.filters.search }).fill("Glasgow");
  await page.getByRole("searchbox", { name: copy.filters.search }).press("Enter");
  await expect(names).toHaveText(["Glasgow street stall"]);
  await expect(page).toHaveURL(/when=past/);
  await frame(page, "Past events in Glasgow");
});

test("Event hosts", async ({ page, request, flowDatabase }) => {
  story(
    "Staff who see supporters see each event's hosts too, before its owner. The protest at Parliament has three, one with no name on Luma.",
  );
  await importLuma(request, BASE);
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff/events`);
  const protest = page.getByRole("row").filter({ hasText: "Protest at Parliament" });
  const hosts = protest.getByRole("cell").nth(5);
  await expect(hosts).toHaveText(`Jane Fixture, Sam Fixture, ${copy.noHostName}`);
  await expect(page.getByRole("row").filter({ hasText: "Leicester" }).getByRole("cell").nth(5)).toHaveText(
    "Alex Fixture",
  );
  await frame(page, "The events, with their hosts");

  story("Searching for a host's name finds the event they host.");
  const search = page.getByRole("searchbox", { name: copy.filters.search });
  await search.fill("Sam Fixture");
  await search.press("Enter");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(protest).toBeVisible();
  await frame(page, "The search for Sam Fixture");

  story(
    "Each host's name links to their supporter page. Jane's lists the protest she hosts, a row apart from her registration for it, and counts each event once.",
  );
  await hosts.getByRole("link", { name: "Jane Fixture" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Jane Fixture" })).toBeVisible();
  const events = page.getByRole("region", { name: staffCopy.supporters.detail.eventsTitle, exact: false });
  await expect(events.getByRole("row").filter({ hasText: staffCopy.supporters.detail.host })).toHaveCount(1);
  // The events she registered for, not declined, or hosts, each once.
  const [count] = runSql(
    flowDatabase,
    `SELECT count(DISTINCT event_id) FROM (
       SELECT g.event_id FROM luma_guests g WHERE g.user_id = 'usr-fixture-1' AND g.removed_at IS NULL AND g.approval_status <> 'declined'
       UNION SELECT h.event_id FROM luma_event_hosts h WHERE h.user_id = 'usr-fixture-1') e`,
  );
  const n = Number(count);
  await expect(page.locator("[class*=counts]").first()).toContainText(
    `${n} ${staffCopy.supporters.detail.eventsCounted(n)}`,
  );
  await frame(page, "Jane Fixture's page");
});

/**
 * A busy calendar, all made up, on the fixed clock's 16 October 2026: every kind
 * of list By owner and By tag have, one owner past the fold, events with no owner
 * and with no tag, a call in both Scotland and Online, one earlier today and
 * yesterday's.
 */
function busyCalendar(database: string) {
  const owners = ["joseph", "annabelle", "sean", "priya", "maya"];
  for (const owner of owners) addStaffAccount(database, `${owner}@pauseai.uk`);
  const events: [at: string, name: string, city: string | null, owner: string | null, tags: string[]][] = [
    ["2026-10-15T18:00:00Z", "Yesterday's pub social", "London", "joseph", ["London"]],
    ["2026-10-16T09:00:00Z", "Breakfast with organisers", "Bristol", null, ["West of England"]],
    ["2026-10-17T11:00:00Z", "Bristol street stall", "Bristol", "priya", ["West of England"]],
    ["2026-10-20T18:00:00Z", "London monthly pub social", "London", "joseph", ["London"]],
    ["2026-10-21T19:00:00Z", "Introduction to PauseAI UK", null, "annabelle", ["Online"]],
    ["2026-10-22T18:30:00Z", "Oxford AI risk talk", "Oxford", null, ["Oxford"]],
    ["2026-10-24T13:00:00Z", "Edinburgh flyering", "Edinburgh", "maya", ["Scotland"]],
    ["2026-10-27T19:00:00Z", "Scotland organisers' call", null, "maya", ["Online", "Scotland"]],
    ["2026-11-03T18:00:00Z", "Lobby your MP day", "London", "joseph", ["Big events", "London"]],
    ["2026-11-04T19:00:00Z", "New volunteers' welcome", null, "sean", []],
    ["2026-11-07T11:00:00Z", "Leeds first meet-up", "Leeds", null, []],
    ["2026-11-10T18:00:00Z", "Cambridge reading group", "Cambridge", "sean", []],
    ["2026-11-14T13:00:00Z", "London flyering", "London", "joseph", ["London"]],
    ["2026-11-18T18:00:00Z", "London film night", "London", "joseph", ["London"]],
    ["2026-11-21T13:00:00Z", "March on Parliament", "London", "joseph", ["Big events", "London"]],
    ["2026-12-02T18:00:00Z", "London panel with speakers", "London", "joseph", ["Big events", "London"]],
    ["2026-12-09T18:00:00Z", "London winter social", "London", "joseph", ["London"]],
  ];
  const text = (value: string | null) => (value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`);
  const values = (rows: string[]) => rows.join(", ");
  runSql(
    database,
    `INSERT INTO luma_events (id, name, url, start_at, access, city, location_type, tags) VALUES ${values(
      events.map(
        ([at, name, city, , tags], i) =>
          `('evt-busy-${i}', ${text(name)}, 'busy-${i}', '${at}', 'manage', ${text(city)}, '${city ? "offline" : "online"}', ARRAY[${tags.map(text).join(", ")}]::text[])`,
      ),
    )};
     INSERT INTO event_owners (event_id, owner, assigned_by) VALUES ${values(
       events.flatMap(([, , , owner], i) => (owner ? [`('evt-busy-${i}', '${owner}@pauseai.uk', 'rules')`] : [])),
     )};
     INSERT INTO luma_people (user_id, email, name)
       SELECT 'usr-busy-' || n, 'guest' || n || '@example.com', 'Guest ' || n FROM generate_series(1, 30) n;
     INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at)
       SELECT 'gst-busy-' || i || '-' || n, 'evt-busy-' || i, 'usr-busy-' || n, 'approved', '2026-10-01T00:00:00Z'
       FROM generate_series(0, ${events.length - 1}) i, generate_series(1, 30) n WHERE n <= 2 + (i * 7) % 29;
     INSERT INTO event_docs (event_id, url, set_by)
       VALUES ('evt-busy-3', 'https://docs.google.com/document/d/made-up-social-plan/edit', 'joseph@pauseai.uk');`,
  );
}

/** A list on the By owner or By tag tab, by its heading's words. */
const eventList = (page: Page, title: string | RegExp) =>
  page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title }) });

test("Events by owner", async ({ page, flowDatabase }) => {
  story(
    "The calendar is busy, and Future's table is long. By owner lists every event to come under who owns it, with the ones nobody owns first, in red.",
  );
  busyCalendar(flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events`);
  await page.getByRole("link", { name: copy.tabs.byOwner }).click();
  await expect(page).toHaveURL(`${BASE}/staff/events?view=owner`);
  const noOwner = eventList(page, new RegExp(`^${copy.noOwner}`));
  await expect(noOwner.getByRole("link", { name: "Oxford AI risk talk" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(copy.noOwner);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await frame(page, "Every event to come, by owner");

  story("Joseph has more than five, so the rest fold. Opening them moves only what's under them in that column.");
  const other = page.getByRole("heading", { level: 2, name: /^priya/ });
  const before = await other.boundingBox();
  const joseph = eventList(page, /^joseph/);
  await joseph.getByText(copy.lists.more(2)).click();
  await expect(joseph.getByRole("link", { name: "London winter social" })).toBeVisible();
  expect(await other.boundingBox()).toEqual(before);
  await frame(page, "Joseph's events, unfolded");

  story("Someone takes the Oxford talk: Edit on its line opens the same bubble as Future's table.");
  await noOwner
    .getByRole("listitem")
    .filter({ hasText: "Oxford AI risk talk" })
    .getByRole("button", { name: copy.edit })
    .click();
  const form = page.getByRole("form", { name: copy.editLabel("Oxford AI risk talk") });
  await form.getByLabel(copy.owner).selectOption("sean@pauseai.uk");
  await frame(page, "The Oxford talk, being given to Sean");

  story("Saved, it's under Sean, and no longer under No owner.");
  await form.getByRole("button", { name: copy.save }).click();
  await expect(eventList(page, /^sean/).getByRole("link", { name: "Oxford AI risk talk" })).toBeVisible();
  await expect(noOwner.getByRole("link", { name: "Oxford AI risk talk" })).toHaveCount(0);
  await frame(page, "The Oxford talk, under Sean");
});

test("Events by tag", async ({ page, flowDatabase }) => {
  story(
    "By tag lists an event under each of its Luma tags: the places, then Big events, Online, and any with no tag. Those with no owner say so in red.",
  );
  busyCalendar(flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events`);
  await page.getByRole("link", { name: copy.tabs.byTag }).click();
  await expect(page).toHaveURL(`${BASE}/staff/events?view=tag`);
  const titles = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(titles.map((title) => title.replace(/\d+$/, ""))).toEqual([
    "London",
    "Oxford",
    "Scotland",
    "West of England",
    "Big events",
    "Online",
    copy.lists.noTag,
  ]);
  await frame(page, "Every event to come, by tag");

  story("The Scotland call is in both lists, each saying the other. Its Edit in Online's list opens under that line.");
  const call = (title: string) =>
    eventList(page, new RegExp(`^${title}`))
      .getByRole("listitem")
      .filter({ hasText: "Scotland organisers' call" });
  await expect(call("Scotland")).toContainText(copy.lists.also("Online"));
  await expect(call("Online")).toContainText(copy.lists.also("Scotland"));
  await call("Online").getByRole("button", { name: copy.edit }).click();
  await expect(call("Online").getByRole("form", { name: copy.editLabel("Scotland organisers' call") })).toBeVisible();
  await frame(page, "The Scotland call's Edit, in Online's list");
  await page.keyboard.press("Escape");

  story("London has more than five, so the rest fold.");
  const london = eventList(page, /^London/);
  await london.getByText(copy.lists.more(1)).click();
  await expect(london.getByRole("link", { name: "London winter social" })).toBeVisible();
  await frame(page, "London's events, unfolded");
});

test("Filters are only on Future and Past", async ({ page, flowDatabase }) => {
  story("Staff filter Future to Oxford, so its table has one event, and they can save that filter.");
  busyCalendar(flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events?place=Oxford`);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await frame(page, "Future, filtered to Oxford");

  story("By owner shows every event to come regardless, and has no filters to set.");
  await page.getByRole("link", { name: copy.tabs.byOwner }).click();
  await expect(page).toHaveURL(`${BASE}/staff/events?view=owner`);
  await expect(page.getByRole("link", { name: "London film night", exact: true }).first()).toBeAttached();
  await expect(page.getByRole("button", { name: staffCopy.filters.saved.chip, exact: true })).toHaveCount(0);
  await frame(page, "By owner, with everything on it");

  story("So does By tag, even if the address has a filter in it, from a link someone kept.");
  await page.goto(`${BASE}/staff/events?view=tag&place=Oxford`);
  await expect(page.getByRole("heading", { level: 2, name: /^London/ })).toBeVisible();
  await frame(page, "By tag, its address naming Oxford");
});

test("An event stays on Future until the end of its day", async ({ page, flowDatabase }) => {
  story(
    "It's 1pm in London. The breakfast this morning has begun, but it's still on Future until midnight, in red as nobody owns it.",
  );
  busyCalendar(flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events`);
  const today = page.getByRole("row").filter({ hasText: "Breakfast with organisers" });
  await expect(today.getByText(copy.noOwner)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Yesterday's pub social" })).toHaveCount(0);
  await frame(page, "This morning's event, still on Future");

  story("It's on By owner too, in the red list.");
  await page.getByRole("link", { name: copy.tabs.byOwner }).click();
  await expect(
    eventList(page, new RegExp(`^${copy.noOwner}`)).getByRole("link", { name: "Breakfast with organisers" }),
  ).toBeVisible();
  await frame(page, "This morning's event, by owner");

  story("Yesterday's is on Past, and this morning's isn't yet.");
  await page.getByRole("link", { name: copy.tabs.past }).click();
  await expect(page.getByRole("row").filter({ hasText: "Yesterday's pub social" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Breakfast with organisers" })).toHaveCount(0);
  await frame(page, "Past, with yesterday's event");
});
