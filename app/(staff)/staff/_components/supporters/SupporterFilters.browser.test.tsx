import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { campaignBySlug } from "@/lib/email-your-mp";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { CONSENT_ORDER } from "@/lib/staff-list-filters";
import SupporterFilters from "./SupporterFilters";
import { CONSENTS, consentKey } from "@/lib/supporters/contact-permissions";
import { supportersSearch } from "@/lib/staff-search";
import { chips, menu } from "@/tests/browser/staff";
import { supportersCopy } from "./copy";
import { politiciansCopy } from "../politicians/copy";

describe("SupporterFilters", () => {
  const copy = supportersCopy.supporters;
  const events = [
    { id: "evt-1", name: "Leeds social", startAt: new Date("2026-10-20T18:00:00Z") },
    { id: "evt-2", name: "Oxford talk", startAt: new Date("2026-10-12T18:00:00Z") },
  ];
  const mps = [{ id: 7, name: "Mo Manchester", constituency: "Manchester Central" }];
  const choices = { events, mps };
  const none = { events: [], mps: [] };

  it("has a chip for each way Consent finds and each it leaves out, the way's icon before its topics", async () => {
    const { filter, ...search } = supportersSearch({
      activity: "registered",
      contact: ["email:newsletter:yes", "!text:events:yes", "email:events:yes", "email:newsletter:asked"],
      erased: "1",
    });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const { topics } = copy.filters;
    const label = copy.columns.subscriptions;
    // Consent's chips first, in its own place; a value it doesn't know, alone.
    expect(chips()).toEqual([
      `${label}: ${staffVocabulary.filters.anyOf([topics.newsletter, topics.events])}`,
      staffVocabulary.filters.notChip(label, topics.events),
      `${label}: email:newsletter:asked`,
      `${copy.columns.badges}: ${copy.badges.registered}`,
    ]);
    const emails = [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith(`${label}: `))!;
    expect(emails.querySelector("svg")).not.toBeNull();
    // Several, so its menu opens as boxes: email's topics alone. It can turn them all to left out.
    const found = await menu(new RegExp(`^${label}:\\s+${topics.newsletter} or`));
    const box = document.querySelector("[popover]:popover-open")!;
    expect(
      [...box.querySelectorAll("input[type=checkbox]")].map((input) => (input as HTMLInputElement).checked),
    ).toEqual([true, true, false]);
    expect(found).toContainEqual([
      staffVocabulary.filters.exceptThese,
      "/staff/supporters?activity=registered&contact=%21text%3Aevents%3Ayes&contact=email%3Anewsletter%3Aasked&contact=%21email%3Anewsletter%3Ayes&contact=%21email%3Aevents%3Ayes",
    ]);
    // The one left out swaps to any consent no other chip has, still left out, and can turn to found.
    const out = await menu(staffVocabulary.filters.notChip(label, topics.events));
    const keeping =
      "/staff/supporters?activity=registered&contact=email%3Anewsletter%3Ayes&contact=email%3Aevents%3Ayes&contact=email%3Anewsletter%3Aasked";
    expect(out).toContainEqual([topics.newsletter, `${keeping}&contact=%21text%3Anewsletter%3Ayes`]);
    expect(out.map(([words]) => words)).toContain(staffVocabulary.filters.onlyThis);
    expect(out.at(-1)).toEqual([staffVocabulary.filters.remove, keeping]);
    // + Filter doesn't offer it; Except does, but for those it has.
    expect((await menu(staffVocabulary.filters.add)).map(([words]) => words)).not.toContain(topics.volunteering);
    const except = await menu(staffVocabulary.filters.except);
    expect(except).toContainEqual([
      topics.volunteering,
      `${keeping}&contact=%21text%3Aevents%3Ayes&contact=%21email%3Avolunteering%3Ayes`,
    ]);
  });

  it("keeps Consent's own button while it only leaves out, a consent chosen there keeping those", async () => {
    const { filter, ...search } = supportersSearch({ contact: "!text:events:yes" });
    void filter;
    await render(<SupporterFilters search={search} choices={none} />);
    const label = copy.columns.subscriptions;
    expect(chips()).toEqual([staffVocabulary.filters.notChip(label, copy.filters.topics.events)]);
    expect(await menu(new RegExp(`^${label}$`))).toContainEqual([
      copy.filters.topics.newsletter,
      "/staff/supporters?contact=%21text%3Aevents%3Ayes&contact=email%3Anewsletter%3Ayes",
    ]);
  });

  it("while choosing who a broadcast goes to, locks the consents it finds, not those it leaves out", async () => {
    const { topics } = copy.filters;
    const label = copy.columns.subscriptions;
    const { filter, ...search } = supportersSearch({
      contact: ["email:newsletter:yes", "!text:events:yes"],
      near: "LS1",
      broadcast: "3",
    });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} lockConsent />);
    const locked = [...document.querySelectorAll("[class*=locked]")];
    expect(locked.map((chip) => chip.textContent)).toEqual([`${label}: ${topics.newsletter}`]);
    expect(locked[0].tagName).toBe("SPAN");
    expect(locked[0].getAttribute("title")).toBe(supportersCopy.consentLocked);
    // Its padlock at the end.
    expect(locked[0].querySelector("svg:last-child[class*=lockIcon]")).not.toBeNull();
    // The one left out opens, with no turning to found, and goes on its own.
    const out = await menu(staffVocabulary.filters.notChip(label, topics.events));
    expect(out.map(([words]) => words)).not.toContain(staffVocabulary.filters.onlyThis);
    expect(out.at(-1)).toEqual([
      staffVocabulary.filters.remove,
      "/staff/supporters?contact=email%3Anewsletter%3Ayes&near=LS1&broadcast=3",
    ]);
    // + Filter doesn't offer Consent; Except does.
    expect((await menu(staffVocabulary.filters.add)).map(([words]) => words)).not.toContain(topics.volunteering);
    expect((await menu(staffVocabulary.filters.except)).map(([words]) => words)).toContain(topics.volunteering);
    // Clear filters keeps what it finds, not what it leaves out.
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.resetFilters }))
      .toHaveAttribute("href", "/staff/supporters?contact=email%3Anewsletter%3Ayes");
  });

  it("while locked, leaves a value it doesn't know open when it's left out, marked as a not", async () => {
    const { filter, ...search } = supportersSearch({ contact: ["email:newsletter:yes", "!email:newsletter:asked"] });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} lockConsent />);
    const label = copy.columns.subscriptions;
    const out = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith(staffVocabulary.filters.notChip(label, "email:newsletter:asked")),
    )!;
    expect(out.querySelector("svg")).not.toBeNull();
    expect(document.querySelectorAll("[class*=locked]")).toHaveLength(1);
  });

  it("offers every consent once in the Consent filter, by email, then text, then call, which is volunteering's alone", () => {
    expect(CONSENT_ORDER.map(consentKey).sort()).toEqual(CONSENTS.map(consentKey).sort());
    expect(CONSENT_ORDER.map((consent) => consent.way)).toEqual([
      ...["email", "email", "email", "text", "text", "text", "call"],
    ]);
    expect(CONSENT_ORDER[0]).toEqual({ topic: "newsletter", way: "email" });
  });

  it("has a chip for a filter only a link turns on, to change or remove, though + Filter doesn't offer it", async () => {
    const { filter, ...search } = supportersSearch({ registered: "30" });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const chip = `${copy.filters.registered}: ${staffVocabulary.filters.lastDays(30)}`;
    const choicesOfChip = await menu(chip);
    expect(choicesOfChip.map(([text]) => text)).toContain(staffVocabulary.filters.lastDays(90));
    expect(choicesOfChip.find(([text]) => text === staffVocabulary.filters.remove)![1]).toBe("/staff/supporters");
    await page.getByRole("button", { name: chip }).click();
    await page.getByRole("button", { name: staffVocabulary.filters.add }).click();
    const offered = [...document.querySelectorAll("#filter-add details > summary")].map((p) => p.textContent);
    expect(offered).not.toContain(copy.filters.registered);
    expect(offered).not.toContain(copy.filters.unsubscribed);
  });

  it("offers every filter in the columns' order, events by name and day", async () => {
    const { filter, ...search } = supportersSearch({});
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    await page.getByRole("button", { name: staffVocabulary.filters.add }).click();
    expect([...document.querySelectorAll("#filter-add details > summary")].map((p) => p.textContent)).toEqual([
      politiciansCopy.politician.country,
      copy.filters.near,
      politiciansCopy.politician.roles.commons,
      copy.columns.badges,
      copy.filters.event,
      copy.filters.campaign,
      copy.filters.first,
    ]);
    // Consent isn't among them: it has its own button, first, its topics under their channels.
    const consent = await menu(copy.columns.subscriptions);
    expect(consent).toContainEqual([copy.filters.topics["events"], "/staff/supporters?contact=email%3Aevents%3Ayes"]);
    const links = await menu(staffVocabulary.filters.add);
    expect(links).toContainEqual([
      copy.filters.eventChoice("Oxford talk", "12 Oct 2026"),
      "/staff/supporters?event=evt-2",
    ]);
    // Except offers the filters that repeat, each choice to leave out.
    await menu(staffVocabulary.filters.except);
    expect([...document.querySelectorAll("#filter-except details > summary")].map((p) => p.textContent)).toEqual([
      politiciansCopy.politician.country,
      politiciansCopy.politician.roles.commons,
      copy.columns.badges,
      copy.columns.subscriptions,
      copy.filters.event,
    ]);
    expect(await menu(staffVocabulary.filters.except)).toContainEqual([
      copy.filters.eventChoice("Oxford talk", "12 Oct 2026"),
      "/staff/supporters?event=%21evt-2",
    ]);
  });

  it("offers MPs by name and constituency, and has a chip for one chosen", async () => {
    const mo = copy.filters.mpChoice("Mo Manchester", "Manchester Central");
    const { filter, ...search } = supportersSearch({ mp: ["7", "x"] });
    void filter;
    const { rerender } = await render(<SupporterFilters search={search} choices={choices} />);
    expect(chips()).toEqual([
      `${politiciansCopy.politician.roles.commons}: ${staffVocabulary.filters.anyOf([mo, "x"])}`,
    ]);
    const { filter: unused, ...unfiltered } = supportersSearch({});
    void unused;
    await rerender(<SupporterFilters search={unfiltered} choices={choices} />);
    expect(await menu(staffVocabulary.filters.add)).toContainEqual([mo, "/staff/supporters?mp=7"]);
  });

  it("has a chip for the events they're at and one, marked, for those they're not", async () => {
    const { filter, ...search } = supportersSearch({ event: ["evt-1", "!evt-2"] });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const leeds = copy.filters.eventChoice("Leeds social", "20 Oct 2026");
    const oxford = copy.filters.eventChoice("Oxford talk", "12 Oct 2026");
    expect(chips()).toEqual([
      `${copy.filters.event}: ${leeds}`,
      staffVocabulary.filters.notChip(copy.filters.event, oxford),
    ]);
    // A chip turns its choice the other way; a choice in a left-out chip stays left out.
    expect(await menu(`${copy.filters.event}: ${leeds}`)).toContainEqual([
      // Leaving out this one too would leave out every event, so it takes off the filter.
      staffVocabulary.filters.exceptThis,
      "/staff/supporters",
    ]);
    const out = await menu(staffVocabulary.filters.notChip(copy.filters.event, oxford));
    expect(out).toContainEqual([staffVocabulary.filters.onlyThis, "/staff/supporters?event=evt-1&event=evt-2"]);
    // The one it finds isn't offered.
    expect(out.map(([text]) => text)).not.toContain(leeds);
    expect(out.at(-1)).toEqual([staffVocabulary.filters.remove, "/staff/supporters?event=evt-1"]);
  });

  it("says what Near found, or that it found nothing, or couldn't look", async () => {
    const near = (text: string) => {
      const { filter, ...search } = supportersSearch({ near: text, within: "25" });
      void filter;
      return search;
    };
    const { rerender } = await render(
      <SupporterFilters
        search={near("LS1")}
        choices={none}
        near={{ latitude: 53.8, longitude: -1.55, place: "Leeds", country: "england" }}
      />,
    );
    expect(chips()).toEqual([`${copy.filters.near}: Leeds, ${copy.filters.miles(25)}`]);
    await rerender(<SupporterFilters search={near("Atlantis")} choices={none} near={null} />);
    expect(chips()).toEqual([`${copy.filters.near}: ${copy.filters.notFound("Atlantis")}, ${copy.filters.miles(25)}`]);
    await rerender(<SupporterFilters search={near("Leeds")} choices={none} near="failed" />);
    expect(chips()).toEqual([`${copy.filters.near}: ${copy.filters.failed("Leeds")}, ${copy.filters.miles(25)}`]);
  });

  it("joins a campaign and whether they wrote in it", async () => {
    const { filter, ...search } = supportersSearch({ campaign: "support-sobel-bill", wrote: "no" });
    void filter;
    await render(<SupporterFilters search={search} choices={none} />);
    expect(chips()).toEqual([campaignBySlug("support-sobel-bill")!.title, copy.filters.wrote.no]);
  });
});
