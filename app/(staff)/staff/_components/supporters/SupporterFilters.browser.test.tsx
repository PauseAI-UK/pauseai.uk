import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { campaignBySlug } from "@/lib/email-your-mp";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { CONSENT_ORDER } from "@/lib/staff-list-filters";
import SupporterFilters from "./SupporterFilters";
import { CONSENTS, consentKey } from "@/lib/supporters/contact-permissions";
import { supportersSearch } from "@/lib/staff-search";
import { chips, menu } from "@/tests/browser/staff";
import { supportersCopy } from "./copy";

describe("SupporterFilters", () => {
  const copy = supportersCopy.supporters;
  const events = [
    { id: "evt-1", name: "Leeds social", startAt: new Date("2026-10-20T18:00:00Z") },
    { id: "evt-2", name: "Oxford talk", startAt: new Date("2026-10-12T18:00:00Z") },
  ];
  const mps = [{ id: 7, name: "Mo Manchester", constituency: "Manchester Central" }];
  const choices = { events, mps };
  const none = { events: [], mps: [] };

  it("has a chip for each filter on, a contact one in two halves, its topic then its answer", async () => {
    const { filter, ...search } = supportersSearch({
      activity: "registered",
      contact: ["email:newsletter:no", "!text:events:yes", "email:newsletter:asked"],
      erased: "1",
    });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const { topics, ways } = copy.filters;
    const label = copy.columns.subscriptions;
    const answers = copy.detail.permissions.answers;
    // Consent's chips first, in its own place.
    expect(chips()).toEqual([
      `${label}: ${topics.newsletter}`,
      answers.email.no,
      staffVocabulary.filters.notChip(label, topics.events),
      answers.text.yes,
      `${label}: email:newsletter:asked`,
      `${copy.columns.badges}: ${copy.badges.registered}`,
    ]);
    // The way's icon in its chip, before its topic's name.
    const topicChip = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === `${label}: ${topics.newsletter}`,
    )!;
    expect(topicChip.querySelector("svg")).not.toBeNull();
    // A lozenge each, for a way and an answer, found or left out. The first half: each consent with its answer,
    // choosing one keeps the other lozenges; then Remove, taking off only that one; the erased notice goes.
    const others = "contact=%21text%3Aevents%3Ayes&contact=email%3Anewsletter%3Aasked";
    const first = await menu(new RegExp(`^${label}:\\s+${topics.newsletter}`));
    const keeping = `/staff/supporters?activity=registered&${others}`;
    expect(first).toContainEqual([topics.newsletter, `${keeping}&contact=email%3Anewsletter%3Ano`]);
    expect(first).toContainEqual([topics.events, `${keeping}&contact=email%3Aevents%3Ano`]);
    expect(first).toContainEqual([topics.events, `${keeping}&contact=text%3Aevents%3Ano`]);
    expect(first.at(-1)).toEqual([staffVocabulary.filters.remove, `/staff/supporters?activity=registered&${others}`]);
    // Under its way's heading, each topic once.
    const box = document.querySelector("[popover]:popover-open")!;
    expect([...box.querySelectorAll("li[class*=choiceGroup]")].map((li) => li.textContent)).toEqual([
      ways.email,
      ways.text,
      ways.call,
    ]);
    await userEvent.keyboard("{Escape}");
    // The second: yes or no, in the words of its way; no Remove.
    const second = await menu(answers.email.no);
    expect(second.map(([words]) => words)).toEqual([answers.email.yes, answers.email.no]);
    expect(second[0]).toEqual([
      answers.email.yes,
      `/staff/supporters?activity=registered&${others}&contact=email%3Anewsletter%3Ayes`,
    ]);
    // A number's, kept left out.
    const texts = await menu(answers.text.yes);
    expect(texts.map(([words]) => words)).toEqual([answers.text.yes, answers.text.no]);
    expect(texts[1]).toEqual([
      answers.text.no,
      "/staff/supporters?activity=registered&contact=email%3Anewsletter%3Ano&contact=email%3Anewsletter%3Aasked&contact=%21text%3Aevents%3Ano",
    ]);
    // + Filter doesn't offer it again.
    const add = await menu(staffVocabulary.filters.add);
    expect(add.map(([words]) => words)).not.toContain(topics.volunteering);
  });

  it("puts Consents of one way and one answer in one lozenge, or between them, + Add offering that way's alone, its answer changing them all", async () => {
    const { filter, ...search } = supportersSearch({
      contact: ["email:newsletter:yes", "text:events:yes", "email:events:yes", "email:volunteering:no"],
    });
    void filter;
    await render(<SupporterFilters search={search} choices={none} />);
    const { topics } = copy.filters;
    const label = copy.columns.subscriptions;
    const answers = copy.detail.permissions.answers;
    expect(chips()).toEqual([
      `${label}: ${staffVocabulary.filters.anyOf([topics.newsletter, topics.events])}`,
      answers.email.yes,
      `${label}: ${topics.events}`,
      answers.text.yes,
      `${label}: ${topics.volunteering}`,
      answers.email.no,
    ]);
    // Several, so its menu opens as boxes: email's topics alone.
    await menu(new RegExp(`^${label}:\\s+${topics.newsletter} or`));
    const box = document.querySelector("[popover]:popover-open")!;
    expect(
      [...box.querySelectorAll("input[type=checkbox]")].map((input) => (input as HTMLInputElement).checked),
    ).toEqual([true, true, false]);
    await userEvent.keyboard("{Escape}");
    // Its answer changes both.
    const second = await menu(answers.email.yes);
    expect(second[1]).toEqual([
      answers.email.no,
      "/staff/supporters?contact=text%3Aevents%3Ayes&contact=email%3Avolunteering%3Ano&contact=email%3Anewsletter%3Ano&contact=email%3Aevents%3Ano",
    ]);
  });

  it("while choosing who a broadcast goes to, shows its Consent locked: no menu, never offered, kept by Clear filters", async () => {
    const { topics } = copy.filters;
    const label = copy.columns.subscriptions;
    const { filter, ...search } = supportersSearch({ contact: "email:newsletter:yes", near: "LS1", broadcast: "3" });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} lockConsent />);
    const locked = [...document.querySelectorAll("[class*=locked]")];
    expect(locked.map((chip) => chip.textContent)).toEqual([
      `${label}: ${topics["newsletter"]}`,
      copy.detail.permissions.answers.email.yes,
    ]);
    expect(locked.every((chip) => chip.tagName === "SPAN")).toBe(true);
    expect(locked.map((chip) => chip.getAttribute("title"))).toEqual([
      staffCopy.broadcastPages.consentLocked,
      staffCopy.broadcastPages.consentLocked,
    ]);
    // Its padlock at the end, in the second half.
    expect(locked.map((chip) => Boolean(chip.querySelector("svg:last-child[class*=lockIcon]")))).toEqual([false, true]);
    expect((await menu(staffVocabulary.filters.add)).map(([words]) => words)).not.toContain(label);
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.resetFilters }))
      .toHaveAttribute("href", "/staff/supporters?contact=email%3Anewsletter%3Ayes");
  });

  it("marks a locked Consent that leaves people out as a not", async () => {
    const { filter, ...search } = supportersSearch({ contact: "!email:newsletter:yes" });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} lockConsent />);
    const locked = document.querySelector("[class*=locked]")!;
    expect(locked.querySelector("svg")).not.toBeNull();
    expect(locked.querySelector("svg:first-child[class*=lockIcon]")).toBeNull();
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
      staffCopy.politician.country,
      copy.filters.near,
      staffCopy.politician.roles.commons,
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
      staffCopy.politician.country,
      staffCopy.politician.roles.commons,
      copy.columns.badges,
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
    expect(chips()).toEqual([`${staffCopy.politician.roles.commons}: ${staffVocabulary.filters.anyOf([mo, "x"])}`]);
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
