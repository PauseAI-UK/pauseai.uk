import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { campaigns } from "@/lib/content/email-your-mp";
import { staffDate } from "@/lib/staff-time";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { spanClass } from "./ui/Grid";
import StaffDashboard from "./StaffDashboard";
import { exampleDashboard, exampleQuietDashboard } from "./StaffDashboard.examples";

const [pm, bill] = campaigns;

describe("StaffDashboard", () => {
  const copy = staffCopy.home.dashboard;

  it("lists what needs a person as a strip each, red when broken and amber when waiting, a button each, or nothing", async () => {
    const { rerender } = await render(<StaffDashboard dashboard={exampleDashboard} permissions={[]} />);
    const list = page.getByRole("list", { name: copy.actionsTitle });
    const items = list.getByRole("listitem").all();
    expect(items.map((item) => item.element().textContent)).toEqual([
      `${copy.actions.heldSync(24)}${copy.actions.heldSyncDetail}${copy.actions.decide}`,
      `${copy.actions.blockedMp("Bouncy McTestface MP")} ${staffCopy.politicians.flags.test}${copy.actions.blockedMpDetail}${copy.actions.openMp}`,
      `${copy.actions.failedImport(jobTitles["import-controlai"])}${copy.actions.failedImportDetail("No PDF linked", "21 Oct 2026, 02:00")}${copy.actions.seeRun}`,
      `${staffCopy.lettersInbox.alert.subject(2, "fixture-letters@pauseai.uk")}${copy.actions.lettersInboxDetail("21 Oct 2026, 03:20")}${copy.actions.lettersInboxButton}`,
    ]);
    await expect
      .element(page.getByRole("link", { name: copy.actions.decide }))
      .toHaveAttribute("href", "/staff/scheduled-jobs/politicians");
    await expect
      .element(page.getByRole("link", { name: copy.actions.openMp }))
      .toHaveAttribute("href", "/staff/politicians/7");
    await expect
      .element(page.getByRole("link", { name: copy.actions.seeRun }))
      .toHaveAttribute("href", "/staff/scheduled-jobs/controlai");
    await expect
      .element(page.getByRole("link", { name: copy.actions.lettersInboxButton }))
      .toHaveAttribute("href", "/staff/scheduled-jobs/gmail");
    // No heading: the strips speak for themselves. Each its icon first; the held import amber, the rest red.
    expect(page.getByRole("heading", { name: copy.actionsTitle }).all()).toHaveLength(0);
    const strips = items.map((item) => item.element().firstElementChild!);
    expect(strips.map((strip) => strip.firstElementChild!.tagName.toLowerCase())).toEqual(["svg", "svg", "svg", "svg"]);
    expect(strips.map((strip) => strip.className.match(/amber|red/)?.[0])).toEqual(["amber", "red", "red", "red"]);
    expect(getComputedStyle(strips[0]).borderLeftWidth).toBe("0px");
    // Each title stands out from its detail; the buttons are the small light ones, all alike.
    const [title, detail] = [...strips[0].querySelector("div")!.children].map((el) => getComputedStyle(el));
    expect(Number(title.fontWeight)).toBeGreaterThan(Number(detail.fontWeight));
    expect(getComputedStyle(list.getByRole("link").first().element()).paddingTop).toBe("4px");
    const looks = list
      .getByRole("link")
      .all()
      .map((link) => getComputedStyle(link.element()).backgroundColor);
    expect(new Set(looks).size).toBe(1);

    await rerender(<StaffDashboard dashboard={exampleQuietDashboard} permissions={[]} />);
    expect(page.getByRole("list", { name: copy.actionsTitle }).all()).toHaveLength(0);
  });

  it("heads the numbers with the windows as tabs", async () => {
    const { rerender } = await render(<StaffDashboard dashboard={exampleDashboard} permissions={[]} />);
    const tabs = page.getByRole("navigation", { name: copy.windows });
    await expect.element(tabs.getByRole("link", { name: copy.window(7) })).toHaveAttribute("aria-current", "page");
    await expect.element(tabs.getByRole("link", { name: copy.window(7) })).toHaveAttribute("href", "/staff");
    await expect.element(tabs.getByRole("link", { name: copy.window(30) })).toHaveAttribute("href", "/staff?days=30");
    await expect.element(tabs.getByRole("link", { name: copy.window(90) })).toHaveAttribute("href", "/staff?days=90");

    await rerender(<StaffDashboard dashboard={exampleQuietDashboard} permissions={[]} />);
    await expect.element(tabs.getByRole("link", { name: copy.window(30) })).toHaveAttribute("aria-current", "page");
    await expect.element(tabs.getByRole("link", { name: copy.window(7) })).not.toHaveAttribute("aria-current");
  });

  it("shows each number in its group with its change on the window before, linked where the person may see it", async () => {
    const { rerender } = await render(
      <StaffDashboard dashboard={exampleDashboard} permissions={["admin", "supporters"]} />,
    );
    const group = (section: string) =>
      page.getByRole("list", { name: staffCopy.nav.sections[section] }).getByRole("listitem").all();
    const mps = group("politicians");
    const events = group("events");
    const supporters = group("supporters");
    expect(mps).toHaveLength(3);
    expect(events).toHaveLength(2);
    expect(supporters).toHaveLength(2);
    // The letters tile: the number, the label, the bar's legend, then the change.
    await expect
      .element(mps[0])
      .toHaveTextContent(`12${copy.metrics.lettersSent(12)} ${pm.title} · 9 ${bill.title} · 3${copy.change.up(4, 7)}`);
    await expect.element(mps[1]).toHaveTextContent(`3${copy.metrics.lettersReplied(3)}${copy.change.down(2, 7)}`);
    await expect
      .element(mps[2])
      .toHaveTextContent(
        `5${copy.metrics.politiciansAgreed(5)} ${pm.title} · 3 ${bill.title} · 2${copy.change.up(2, 7)}`,
      );
    await expect.element(events[1]).toHaveTextContent(`9${copy.metrics.eventsHeld(9)}${copy.change.up(3, 7)}`);
    // With a bar, the letters tile takes a third of the grid, so its legend fits; the rest a sixth.
    expect(mps[0].element().className).toBe(spanClass(2));
    expect(mps[1].element().className).toBe(spanClass(1));
    // The bar's segments are as wide as each campaign's share.
    const segments = mps[0].element().querySelectorAll("[data-campaign]");
    expect([...segments].map((segment) => (segment as HTMLElement).style.flexGrow)).toEqual(["9", "3", "", ""]);
    // Up is green for letters, red for unsubscribes; down is red for replies, green for unsubscribes.
    const changeClass = (item: ReturnType<typeof page.getByRole>) =>
      item.element().querySelector(":scope > * > span:last-child")!.className;
    expect(changeClass(mps[0])).toMatch(/good/);
    expect(changeClass(mps[1])).toMatch(/bad/);
    expect(changeClass(supporters[1])).toMatch(/good/);
    // A sparkline on registrations, with the week's count on each point.
    const sparkline = (label: string) => page.getByRole("img", { name: copy.series(label, 7, 8) });
    await expect.element(sparkline(copy.metrics.eventRegistrations(277))).toBeVisible();
    // New supporters in bars by source, with the week's count of each source in the legend, and half the grid to fit them.
    const sourceBars = page.getByRole("img", { name: copy.bySourceName(copy.metrics.supportersAdded(176), 7, 8) });
    await expect.element(sourceBars).toBeVisible();
    expect(supporters[0].element().textContent).toContain(`${staffCopy.supporters.sources.luma} · 115`);
    expect(supporters[0].element().textContent).toContain(`${staffCopy.supporters.sources.civicrm} · 44`);
    expect(supporters[0].element().textContent).not.toContain(staffCopy.supporters.sources["web-form"]);
    expect(supporters[0].element().className).toBe(spanClass(3));
    // Pointing at a bar says its week's count and what it's made of.
    const barsBox = sourceBars.element().getBoundingClientRect();
    sourceBars
      .element()
      .dispatchEvent(
        new PointerEvent("pointermove", { clientX: barsBox.right - 1, clientY: barsBox.top, bubbles: true }),
      );
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(
        `${copy.seriesPoint(7, staffDate(exampleDashboard.supportersBySource[7].from), 176)} ${staffCopy.supporters.sources.luma}115 ${staffCopy.supporters.sources.civicrm}44 ${staffCopy.supporters.sources["email-your-mp"]}17`,
      );
    sourceBars.element().dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body }));
    await expect.element(page.getByRole("status")).not.toBeInTheDocument();
    // Pointing at a point names its week by the day it begins.
    const line = sparkline(copy.metrics.eventRegistrations(277)).element();
    const box = line.getBoundingClientRect();
    line.dispatchEvent(new PointerEvent("pointermove", { clientX: box.right - 1, clientY: box.top, bubbles: true }));
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(copy.seriesPoint(7, staffDate(exampleDashboard.series.eventRegistrations[7].from), 277));
    expect(page.getByRole("img").all()).toHaveLength(2);
    // The whole tile is the link, to the page that lists what it counts.
    const tileLink = (text: string) => page.getByText(text).element().closest("a");
    const lands = (text: string) => tileLink(text)?.getAttribute("href");
    expect(lands(copy.metrics.lettersSent(12))).toBe("/staff/emails?type=campaign&sent=7");
    expect(lands(copy.metrics.lettersReplied(3))).toBe("/staff/emails?type=campaign&type=mailing&replied=7");
    expect(lands(copy.metrics.supportersAdded(176))).toBe("/staff/supporters?first=7&sort=first&dir=desc");
    expect(lands(copy.metrics.eventRegistrations(277))).toBe("/staff/supporters?registered=7");
    expect(lands(copy.metrics.unsubscribes(1))).toBe("/staff/supporters?unsubscribed=7");
    expect(lands(copy.metrics.eventsHeld(9))).toBe("/staff/events?when=past&held=7");

    // Letters are for staff who see supporters.
    await rerender(<StaffDashboard dashboard={exampleDashboard} permissions={["admin"]} />);
    expect(tileLink(copy.metrics.lettersSent(12))).toBeNull();
    await rerender(<StaffDashboard dashboard={exampleDashboard} permissions={["supporters"]} />);
    expect(lands(copy.metrics.lettersReplied(3))).toBe("/staff/emails?type=campaign&type=mailing&replied=7");
    expect(lands(copy.metrics.supportersAdded(176))).toBe("/staff/supporters?first=7&sort=first&dir=desc");

    await rerender(<StaffDashboard dashboard={exampleDashboard} permissions={[]} />);
    expect(tileLink(copy.metrics.supportersAdded(176))).toBeNull();
    await expect.element(page.getByText(copy.metrics.supportersAdded(176))).toBeVisible();
    expect(tileLink(copy.metrics.lettersSent(12))).toBeNull();
    // Our events are open to all staff.
    expect(lands(copy.metrics.eventsHeld(9))).toBe("/staff/events?when=past&held=7");
    // Several signed: those who signed in the window, newest first.
    expect(tileLink(copy.metrics.politiciansAgreed(5))?.getAttribute("href")).toBe(
      "/staff/politicians?agreed=7&status=any&sort=asks",
    );
    // One signed: their page.
    await rerender(
      <StaffDashboard
        dashboard={{
          ...exampleDashboard,
          counts: { ...exampleDashboard.counts, politiciansAgreed: { current: 1, previous: 3 } },
          byCampaign: { ...exampleDashboard.byCampaign, politiciansAgreed: { [bill.slug]: 1 } },
          agreedMp: 7,
        }}
        permissions={[]}
      />,
    );
    expect(tileLink(copy.metrics.politiciansAgreed(1))?.getAttribute("href")).toBe("/staff/politicians/7");

    // A quiet month: nothing reads "No", with no test letters and no bar; the change is over 30 days.
    await rerender(<StaffDashboard dashboard={exampleQuietDashboard} permissions={[]} />);
    const month = page.getByRole("img", { name: copy.series(copy.metrics.eventRegistrations(4), 30, 8) }).element();
    const monthBox = month.getBoundingClientRect();
    month.dispatchEvent(
      new PointerEvent("pointermove", { clientX: monthBox.right - 1, clientY: monthBox.top, bubbles: true }),
    );
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(copy.seriesPoint(30, staffDate(exampleQuietDashboard.series.eventRegistrations[7].from), 4));
    const quiet = group("politicians");
    await expect
      .element(quiet[0])
      .toHaveTextContent(`${copy.none}${copy.metrics.lettersSent(0)}${copy.change.same(30)}`);
    await expect
      .element(quiet[1])
      .toHaveTextContent(`${copy.none}${copy.metrics.lettersReplied(0)}${copy.change.down(1, 30)}`);
    expect(quiet[0].element().querySelectorAll("[data-campaign]")).toHaveLength(0);
    // With no signature in the window: its list, empty, as the tile says none.
    expect(tileLink(copy.metrics.politiciansAgreed(0))?.getAttribute("href")).toBe(
      "/staff/politicians?agreed=30&status=any&sort=asks",
    );
    // With no bar the letters tile takes a sixth like the rest; a line of nothing but zeros isn't drawn.
    expect(quiet[0].element().className).toBe(spanClass(1));
    const flat = {
      ...exampleQuietDashboard,
      supportersBySource: exampleQuietDashboard.supportersBySource.map((point) => ({
        ...point,
        count: 0,
        sources: {},
      })),
    };
    await rerender(<StaffDashboard dashboard={flat} permissions={[]} />);
    await expect
      .element(page.getByRole("img", { name: copy.bySourceName(copy.metrics.supportersAdded(0), 30, 8) }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("img", { name: copy.series(copy.metrics.eventRegistrations(4), 30, 8) }))
      .toBeVisible();
  });
});
