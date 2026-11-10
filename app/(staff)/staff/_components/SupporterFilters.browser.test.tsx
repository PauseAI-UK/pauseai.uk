import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { campaignBySlug } from "@/lib/email-your-mp";
import { staffCopy } from "@/lib/content/staff-interface";
import { SUBSCRIPTION_ORDER } from "@/lib/staff-list-filters";
import SupporterFilters from "./SupporterFilters";
import { CHANNELS, topicsOf } from "@/lib/contact-permissions";
import { supportersSearch } from "@/lib/staff-search";
import { chips, menu } from "@/tests/browser/staff";

describe("SupporterFilters", () => {
  const copy = staffCopy.supporters;
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
      contact: ["email:pauseai-updates:no", "!phone:march-day:yes", "email:site-forms:asked"],
      erased: "1",
    });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const { topics, channels, ways } = copy.filters;
    const label = copy.columns.subscriptions;
    const answers = copy.detail.permissions.answers;
    // Consent's chips first, in its own place.
    expect(chips()).toEqual([
      `${label}: ${topics["pauseai-updates"]}`,
      answers.email.no,
      staffCopy.filters.notChip(label, topics["march-day"]),
      answers.text.yes,
      `${label}: email:site-forms:asked`,
      `${copy.columns.badges}: ${copy.badges.registered}`,
    ]);
    // The topic's icon in its chip, before its name.
    const topicChip = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === `${label}: ${topics["pauseai-updates"]}`,
    )!;
    expect(topicChip.querySelector("svg")).not.toBeNull();
    // Consent doesn't repeat, so several can only come from an old link or saved filter: a chip each. The first
    // half: each topic, choosing one takes the filter's place, keeping the answer where the topic can give it; then
    // Remove, taking off only that one; the erased notice goes.
    const others = "contact=%21phone%3Amarch-day%3Ayes&contact=email%3Asite-forms%3Aasked";
    const first = await menu(new RegExp(`^${label}:\\s+${topics["pauseai-updates"]}`));
    expect(first).toContainEqual([
      topics["site-forms"],
      "/staff/supporters?activity=registered&contact=email%3Asite-forms%3Ano",
    ]);
    expect(first.at(-1)).toEqual([staffCopy.filters.remove, `/staff/supporters?activity=registered&${others}`]);
    // Under its channel's heading, each once, a phone's ways quiet after it.
    const box = document.querySelector("[popover]:popover-open")!;
    expect([...box.querySelectorAll("li[class*=choiceGroup]")].map((li) => li.textContent)).toEqual([
      channels.email,
      channels.phone,
    ]);
    expect(first.map(([words]) => words)).toContain(`${topics.volunteering}${ways["call-or-text"]}`);
    // Changing the topic keeps a no; one that can't give the answer had, not sure, takes its best.
    const fromNo = await menu(new RegExp(`^${label}:\\s+${topics["pauseai-updates"]}`));
    expect(fromNo).toContainEqual([
      `${topics["luma-calendar"]}`,
      "/staff/supporters?activity=registered&contact=email%3Aluma-calendar%3Ano",
    ]);
    expect(fromNo).toContainEqual([
      `${topics["march-day"]}${ways.text}`,
      "/staff/supporters?activity=registered&contact=phone%3Amarch-day%3Ano",
    ]);
    // The second: each answer the topic can give, in its words, the updates never a sure yes; no Remove.
    const second = await menu(answers.email.no);
    expect(second.map(([words]) => words)).toEqual([answers.email.unsure, answers.email.no]);
    expect(second[0]).toEqual([
      answers.email.unsure,
      `/staff/supporters?activity=registered&${others}&contact=email%3Apauseai-updates%3Aunsure`,
    ]);
    // A number's answers in the words of the ways its topic allows, kept left out.
    const march = await menu(answers.text.yes);
    expect(march.map(([words]) => words)).toEqual([answers.text.yes, answers.text.no]);
    expect(march[1]).toEqual([
      answers.text.no,
      "/staff/supporters?activity=registered&contact=email%3Apauseai-updates%3Ano&contact=email%3Asite-forms%3Aasked&contact=%21phone%3Amarch-day%3Ano",
    ]);
    // + Filter doesn't offer it again.
    const add = await menu(staffCopy.filters.add);
    expect(add.map(([words]) => words)).not.toContain(`${topics.volunteering}${ways["call-or-text"]}`);
  });

  it("changes Consent's topic to its best answer when the new one can't give the answer it had", async () => {
    const { topics } = copy.filters;
    const label = copy.columns.subscriptions;
    const at = async (contact: string, topic: string) => {
      const { filter, ...search } = supportersSearch({ contact });
      void filter;
      await render(<SupporterFilters search={search} choices={choices} />);
      const options = await menu(new RegExp(`^${label}:\\s+${topic}`));
      await userEvent.keyboard("{Escape}");
      return options;
    };
    // Not sure, which our forms can't give: a yes. A yes, which the updates can't: not sure.
    expect(await at("email:pauseai-updates:unsure", topics["pauseai-updates"])).toContainEqual([
      topics["site-forms"],
      "/staff/supporters?contact=email%3Asite-forms%3Ayes",
    ]);
    expect(await at("email:site-forms:yes", topics["site-forms"])).toContainEqual([
      topics["pauseai-updates"],
      "/staff/supporters?contact=email%3Apauseai-updates%3Aunsure",
    ]);
  });

  it("while choosing who a broadcast goes to, shows its Consent locked: no menu, never offered, kept by Clear filters", async () => {
    const { topics } = copy.filters;
    const label = copy.columns.subscriptions;
    const { filter, ...search } = supportersSearch({ contact: "email:site-forms:yes", near: "LS1", broadcast: "3" });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} lockConsent />);
    const locked = [...document.querySelectorAll("[class*=locked]")];
    expect(locked.map((chip) => chip.textContent)).toEqual([
      `${label}: ${topics["site-forms"]}`,
      copy.detail.permissions.answers.email.yes,
    ]);
    expect(locked.every((chip) => chip.tagName === "SPAN")).toBe(true);
    expect(locked.map((chip) => chip.getAttribute("title"))).toEqual([
      staffCopy.broadcastPages.consentLocked,
      staffCopy.broadcastPages.consentLocked,
    ]);
    // Its padlock at the end, in the second half.
    expect(locked.map((chip) => Boolean(chip.querySelector("svg:last-child[class*=lockIcon]")))).toEqual([false, true]);
    expect((await menu(staffCopy.filters.add)).map(([words]) => words)).not.toContain(label);
    await expect
      .element(page.getByRole("link", { name: staffCopy.resetFilters }))
      .toHaveAttribute("href", "/staff/supporters?contact=email%3Asite-forms%3Ayes");
  });

  it("marks a locked Consent that leaves people out as a not", async () => {
    const { filter, ...search } = supportersSearch({ contact: "!email:site-forms:yes" });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} lockConsent />);
    const locked = document.querySelector("[class*=locked]")!;
    expect(locked.querySelector("svg")).not.toBeNull();
    expect(locked.querySelector("svg:first-child[class*=lockIcon]")).toBeNull();
  });

  it("offers every topic once in the Consent filter, email's then phone's, ours first", () => {
    expect(SUBSCRIPTION_ORDER.map(([channel, topic]) => `${channel}:${topic}`).sort()).toEqual(
      CHANNELS.flatMap((channel) => topicsOf(channel).map((topic) => `${channel}:${topic}`)).sort(),
    );
    expect(SUBSCRIPTION_ORDER.map(([channel]) => channel)).toEqual([...SUBSCRIPTION_ORDER.map(([c]) => c)].sort());
    expect(SUBSCRIPTION_ORDER[0]).toEqual(["email", "site-forms"]);
  });

  it("has a chip for a filter only a link turns on, to change or remove, though + Filter doesn't offer it", async () => {
    const { filter, ...search } = supportersSearch({ registered: "30" });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const chip = `${copy.filters.registered}: ${staffCopy.filters.lastDays(30)}`;
    const choicesOfChip = await menu(chip);
    expect(choicesOfChip.map(([text]) => text)).toContain(staffCopy.filters.lastDays(90));
    expect(choicesOfChip.find(([text]) => text === staffCopy.filters.remove)![1]).toBe("/staff/supporters");
    await page.getByRole("button", { name: chip }).click();
    await page.getByRole("button", { name: staffCopy.filters.add }).click();
    const offered = [...document.querySelectorAll("#filter-add details > summary")].map((p) => p.textContent);
    expect(offered).not.toContain(copy.filters.registered);
    expect(offered).not.toContain(copy.filters.unsubscribed);
  });

  it("offers every filter in the columns' order, events by name and day", async () => {
    const { filter, ...search } = supportersSearch({});
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    await page.getByRole("button", { name: staffCopy.filters.add }).click();
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
    expect(consent).toContainEqual([
      copy.filters.topics["luma-calendar"],
      "/staff/supporters?contact=email%3Aluma-calendar%3Ayes",
    ]);
    const links = await menu(staffCopy.filters.add);
    expect(links).toContainEqual([
      copy.filters.eventChoice("Oxford talk", "12 Oct 2026"),
      "/staff/supporters?event=evt-2",
    ]);
    // Except offers the filters that repeat, each choice to leave out.
    await menu(staffCopy.filters.except);
    expect([...document.querySelectorAll("#filter-except details > summary")].map((p) => p.textContent)).toEqual([
      staffCopy.politician.country,
      staffCopy.politician.roles.commons,
      copy.columns.badges,
      copy.filters.event,
    ]);
    expect(await menu(staffCopy.filters.except)).toContainEqual([
      copy.filters.eventChoice("Oxford talk", "12 Oct 2026"),
      "/staff/supporters?event=%21evt-2",
    ]);
  });

  it("offers MPs by name and constituency, and has a chip for one chosen", async () => {
    const mo = copy.filters.mpChoice("Mo Manchester", "Manchester Central");
    const { filter, ...search } = supportersSearch({ mp: ["7", "x"] });
    void filter;
    const { rerender } = await render(<SupporterFilters search={search} choices={choices} />);
    expect(chips()).toEqual([`${staffCopy.politician.roles.commons}: ${staffCopy.filters.anyOf([mo, "x"])}`]);
    const { filter: unused, ...unfiltered } = supportersSearch({});
    void unused;
    await rerender(<SupporterFilters search={unfiltered} choices={choices} />);
    expect(await menu(staffCopy.filters.add)).toContainEqual([mo, "/staff/supporters?mp=7"]);
  });

  it("has a chip for the events they're at and one, marked, for those they're not", async () => {
    const { filter, ...search } = supportersSearch({ event: ["evt-1", "!evt-2"] });
    void filter;
    await render(<SupporterFilters search={search} choices={choices} />);
    const leeds = copy.filters.eventChoice("Leeds social", "20 Oct 2026");
    const oxford = copy.filters.eventChoice("Oxford talk", "12 Oct 2026");
    expect(chips()).toEqual([`${copy.filters.event}: ${leeds}`, staffCopy.filters.notChip(copy.filters.event, oxford)]);
    // A chip turns its choice the other way; a choice in a left-out chip stays left out.
    expect(await menu(`${copy.filters.event}: ${leeds}`)).toContainEqual([
      // Leaving out this one too would leave out every event, so it takes off the filter.
      staffCopy.filters.exceptThis,
      "/staff/supporters",
    ]);
    const out = await menu(staffCopy.filters.notChip(copy.filters.event, oxford));
    expect(out).toContainEqual([staffCopy.filters.onlyThis, "/staff/supporters?event=evt-1&event=evt-2"]);
    // The one it finds isn't offered.
    expect(out.map(([text]) => text)).not.toContain(leeds);
    expect(out.at(-1)).toEqual([staffCopy.filters.remove, "/staff/supporters?event=evt-1"]);
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
