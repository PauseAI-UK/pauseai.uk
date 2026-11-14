import { describe, expect, it, vi } from "vitest";
import type { SearchedEvent } from "./staff-events";
import {
  eventListColumns,
  eventsByOwner,
  eventsByTag,
  EVENT_LIST_SHOWS,
  EVENTS_PAGE_SIZE,
  findEvents,
  stillToCome,
  type EventFilter,
  type EventList,
} from "./list";

const NOW = new Date("2026-11-02T12:00:00.000Z");

const event = (id: string, more: Partial<SearchedEvent> = {}): SearchedEvent => ({
  id,
  name: `Event ${id}`,
  url: `https://luma.com/${id}`,
  startAt: new Date("2026-12-01T18:00:00.000Z"),
  city: "London",
  tags: [],
  removed: false,
  going: 0,
  owner: null,
  doc: null,
  hosts: [],
  hostEmails: [],
  ...more,
});

const events = [
  event("a", {
    name: "Banner making",
    startAt: new Date("2026-11-20T18:00:00.000Z"),
    city: "Oxford",
    going: 5,
    tags: ["Oxford"],
    hosts: [{ name: "Jane Smith", supporterId: 1 }],
    hostEmails: ["jane.host@example.com"],
  }),
  event("b", {
    name: "alpha talk",
    startAt: new Date("2026-11-10T18:00:00.000Z"),
    city: null,
    going: 9,
    owner: "jo@pauseai.uk",
  }),
  event("c", { startAt: new Date("2026-11-10T18:00:00.000Z"), doc: "https://docs.google.com/d", tags: ["Big"] }),
  event("d", { name: "Cancelled picnic", removed: true }),
  event("old", { startAt: new Date("2025-01-01T18:00:00.000Z") }),
  event("recent", { startAt: new Date("2026-10-01T18:00:00.000Z"), owner: "sean@pauseai.uk" }),
];

const future = (more: Partial<EventFilter> = {}): EventFilter => ({
  tab: "future",
  removed: false,
  sort: { key: "start", dir: "asc" },
  page: 1,
  ...more,
});

const ids = (filter: EventFilter) => findEvents(events, filter, NOW).events.map((e) => e.id);

describe("findEvents", () => {
  it("finds those started in the last so many days", () => {
    vi.stubEnv("FIXTURE_NOW", NOW.toISOString());
    const held = [
      event("this-week", { startAt: new Date("2026-10-30T18:00:00.000Z") }),
      event("this-month", { startAt: new Date("2026-10-10T18:00:00.000Z") }),
      event("to-come", { startAt: new Date("2026-11-20T18:00:00.000Z") }),
    ];
    const past = { ...future(), tab: "past" as const, sort: { key: "start" as const, dir: "desc" as const } };
    const found = (heldDays: number) => findEvents(held, { ...past, heldDays }, NOW).events.map((e) => e.id);
    expect(found(7)).toEqual(["this-week"]);
    expect(found(30)).toEqual(["this-week", "this-month"]);
    vi.unstubAllEnvs();
  });

  it("finds those to come on Future, soonest first, a tie by ID; and those past on Past, latest first", () => {
    expect(ids(future())).toEqual(["b", "c", "a"]);
    expect(ids({ tab: "past", removed: false, sort: { key: "start", dir: "desc" }, page: 1 })).toEqual([
      "recent",
      "old",
    ]);
    expect(findEvents(events, future(), NOW)).toMatchObject({ total: 3, pages: 1, removed: 0 });
  });

  it("searches names, whatever their case, and hosts' names and emails, and owners' emails", () => {
    expect(ids(future({ search: "ALPHA" }))).toEqual(["b"]);
    expect(ids(future({ search: "jane smith" }))).toEqual(["a"]);
    expect(ids(future({ search: "jane.host@" }))).toEqual(["a"]);
    expect(ids(future({ search: "jo@pauseai" }))).toEqual(["b"]);
  });

  it("finds only those taken off Luma, or only those still on it", () => {
    expect(ids(future({ removed: true }))).toEqual(["d"]);
    expect(ids(future())).not.toContain("d");
  });

  it("counts, for a search that finds none, those it would find taken off Luma", () => {
    expect(findEvents(events, future({ search: "picnic" }), NOW)).toMatchObject({ total: 0, removed: 1 });
    // Not when it finds some, nor when it's of those taken off Luma, nor with no search.
    expect(findEvents(events, future({ search: "alpha" }), NOW).removed).toBe(0);
    expect(findEvents(events, future({ search: "picnic", removed: true }), NOW)).toMatchObject({
      total: 1,
      removed: 0,
    });
    expect(findEvents(events, future({ search: "nothing" }), NOW).removed).toBe(0);
    expect(findEvents(events, future({ owner: ["nobody@pauseai.uk"] }), NOW).removed).toBe(0);
  });

  it("finds those with any of an owner, a tag or a place; and leaves out those with any", () => {
    expect(ids(future({ owner: ["none"] }))).toEqual(["c", "a"]);
    expect(ids(future({ owner: ["jo@pauseai.uk"] }))).toEqual(["b"]);
    expect(ids(future({ tag: ["Oxford", "Big"] }))).toEqual(["c", "a"]);
    expect(ids(future({ place: ["online"] }))).toEqual(["b"]);
    expect(ids(future({ place: ["London", "Oxford"] }))).toEqual(["c", "a"]);
    expect(ids(future({ not: { owner: ["none"], tag: ["Oxford"] } }))).toEqual(["b"]);
  });

  it("sorts by each column, either way, a tie by when it starts in the tab's own order", () => {
    const by = (key: EventFilter["sort"]["key"], dir: "asc" | "desc") => ids(future({ sort: { key, dir } }));
    expect(by("name", "asc")).toEqual(["b", "a", "c"]);
    expect(by("name", "desc")).toEqual(["c", "a", "b"]);
    // Online, with no city, first.
    expect(by("place", "asc")).toEqual(["b", "c", "a"]);
    expect(by("going", "desc")).toEqual(["b", "a", "c"]);
    // No owner first; those with none, by when.
    expect(by("owner", "asc")).toEqual(["c", "a", "b"]);
    // No doc first, either way.
    expect(by("doc", "asc")).toEqual(["b", "a", "c"]);
    expect(by("doc", "desc")).toEqual(["c", "b", "a"]);
    expect(
      findEvents(events, { tab: "past", removed: false, sort: { key: "going", dir: "desc" }, page: 1 }, NOW).events.map(
        (e) => e.id,
      ),
    ).toEqual(["recent", "old"]);
  });

  it("sorts names in English order, accented letters among the plain ones", () => {
    const named = ["Zine fair", "Éire meetup", "Ealing walk"].map((name) => event(name, { name }));
    expect(findEvents(named, future({ sort: { key: "name", dir: "asc" } }), NOW).events.map((e) => e.name)).toEqual([
      "Ealing walk",
      "Éire meetup",
      "Zine fair",
    ]);
  });

  it("gives a page at a time", () => {
    const many = Array.from({ length: EVENTS_PAGE_SIZE + 2 }, (_, i) => event(`e${String(i).padStart(3, "0")}`));
    const second = findEvents(many, future({ page: 2 }), NOW);
    expect(second).toMatchObject({ total: EVENTS_PAGE_SIZE + 2, pages: 2 });
    expect(second.events.map((e) => e.id)).toEqual(["e100", "e101"]);
    expect(findEvents([], future(), NOW)).toEqual({ events: [], total: 0, pages: 1, removed: 0 });
  });

  it("gives every one it finds, on one page, for lists by a grouping, whatever page the URL says", () => {
    const many = Array.from({ length: EVENTS_PAGE_SIZE + 2 }, (_, i) => event(`e${String(i).padStart(3, "0")}`));
    const grouped = findEvents(many, future({ group: "owner", page: 2 }), NOW);
    expect(grouped).toMatchObject({ total: EVENTS_PAGE_SIZE + 2, pages: 1 });
    expect(grouped.events).toHaveLength(EVENTS_PAGE_SIZE + 2);
  });
});

describe("stillToCome", () => {
  it("is so until the end of its day in London, and not after", () => {
    expect(stillToCome(new Date("2026-11-02T09:00:00.000Z"), new Date("2026-11-02T23:59:59.000Z"))).toBe(true);
    expect(stillToCome(new Date("2026-11-02T09:00:00.000Z"), new Date("2026-11-03T00:00:00.000Z"))).toBe(false);
    expect(stillToCome(new Date("2026-11-03T09:00:00.000Z"), new Date("2026-11-02T12:00:00.000Z"))).toBe(true);
  });

  it("ends at midnight by the clocks in summer, an hour before midnight UTC", () => {
    expect(stillToCome(new Date("2026-07-01T09:00:00.000Z"), new Date("2026-07-01T22:59:59.000Z"))).toBe(true);
    expect(stillToCome(new Date("2026-07-01T09:00:00.000Z"), new Date("2026-07-01T23:00:00.000Z"))).toBe(false);
    // 00:30 on 2 July in London, though still 1 July in UTC, is that day's.
    expect(stillToCome(new Date("2026-07-01T23:30:00.000Z"), new Date("2026-07-02T22:59:59.000Z"))).toBe(true);
  });

  it("holds across the clocks going forward, on the day of 23 hours", () => {
    expect(stillToCome(new Date("2026-03-28T23:30:00.000Z"), new Date("2026-03-28T23:59:59.000Z"))).toBe(true);
    expect(stillToCome(new Date("2026-03-28T23:30:00.000Z"), new Date("2026-03-29T00:00:00.000Z"))).toBe(false);
    expect(stillToCome(new Date("2026-03-29T22:30:00.000Z"), new Date("2026-03-29T22:59:59.000Z"))).toBe(true);
    expect(stillToCome(new Date("2026-03-29T22:30:00.000Z"), new Date("2026-03-29T23:00:00.000Z"))).toBe(false);
  });

  it("holds across the clocks going back, on the day of 25 hours", () => {
    expect(stillToCome(new Date("2026-10-24T22:30:00.000Z"), new Date("2026-10-24T22:59:59.000Z"))).toBe(true);
    expect(stillToCome(new Date("2026-10-24T22:30:00.000Z"), new Date("2026-10-24T23:00:00.000Z"))).toBe(false);
    expect(stillToCome(new Date("2026-10-25T00:30:00.000Z"), new Date("2026-10-25T23:59:59.000Z"))).toBe(true);
    expect(stillToCome(new Date("2026-10-25T00:30:00.000Z"), new Date("2026-10-26T00:00:00.000Z"))).toBe(false);
  });
});

describe("findEvents around today", () => {
  const today = event("earlier-today", { startAt: new Date("2026-11-02T09:00:00.000Z") });
  const yesterday = event("yesterday", { startAt: new Date("2026-11-01T23:30:00.000Z") });
  const past = { ...future(), tab: "past" as const, sort: { key: "start" as const, dir: "desc" as const } };

  it("keeps an event earlier today on Future, and yesterday's on Past", () => {
    const found = (filter: EventFilter) => findEvents([today, yesterday], filter, NOW).events.map((e) => e.id);
    expect(found(future())).toEqual(["earlier-today"]);
    expect(found(past)).toEqual(["yesterday"]);
  });

  it("counts it among those held, as the dashboard's tile does, once it's begun", () => {
    vi.stubEnv("FIXTURE_NOW", NOW.toISOString());
    const later = event("later-today", { startAt: new Date("2026-11-02T18:00:00.000Z") });
    const found = findEvents([today, later, yesterday], { ...past, heldDays: 7 }, NOW).events.map((e) => e.id);
    expect(found).toEqual(["earlier-today", "yesterday"]);
    vi.unstubAllEnvs();
  });
});

describe("eventsByOwner", () => {
  const titles = (lists: EventList[]) => lists.map((list) => [list.title, list.events.map((e) => e.id)]);

  it("lists by the owner's address, alphabetically, those with no owner first", () => {
    const events = [
      event("a", { owner: "sean@pauseai.uk" }),
      event("b", { owner: "jo@pauseai.uk" }),
      event("c", { owner: null }),
      event("d", { owner: "sean@pauseai.uk" }),
    ];
    expect(titles(eventsByOwner(events))).toEqual([
      ["No owner", ["c"]],
      ["jo@pauseai.uk", ["b"]],
      ["sean@pauseai.uk", ["a", "d"]],
    ]);
  });

  it("has no list of those with no owner when there are none", () => {
    expect(titles(eventsByOwner([event("a", { owner: "jo@pauseai.uk" })]))).toEqual([["jo@pauseai.uk", ["a"]]]);
  });
});

describe("eventsByTag", () => {
  const titles = (lists: EventList[]) => lists.map((list) => [list.title, list.events.map((e) => e.id)]);

  it("lists an event under each of its tags: places in order, then Big events, Online and No tag", () => {
    const events = [
      event("untagged", { city: "Leeds", tags: [] }),
      event("online", { city: null, tags: ["Online"] }),
      event("big", { tags: ["Big events", "London"] }),
      event("scotland-call", { city: null, tags: ["Online", "Scotland"] }),
    ];
    expect(titles(eventsByTag(events))).toEqual([
      ["London", ["big"]],
      ["Scotland", ["scotland-call"]],
      ["Big events", ["big"]],
      ["Online", ["online", "scotland-call"]],
      ["No tag", ["untagged"]],
    ]);
  });

  it("puts one with no tags under Online only if it has no city", () => {
    expect(titles(eventsByTag([event("a", { city: null, tags: [] })]))).toEqual([["Online", ["a"]]]);
    expect(titles(eventsByTag([event("a", { city: "Leeds", tags: [] })]))).toEqual([["No tag", ["a"]]]);
  });
});

describe("eventListColumns", () => {
  const list = (title: string, n: number): EventList => ({
    title,
    events: Array.from({ length: n }, (_, i) => event(`${title}-${i}`)),
  });
  const split = (...lists: EventList[]) => eventListColumns(lists).map((column) => column.map((one) => one.title));

  it("runs down the first column then the second, split at about half the height", () => {
    expect(split(list("a", 3), list("b", 3), list("c", 3), list("d", 3))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("counts a long list only as far as it folds, as it's closed", () => {
    const long = list("long", EVENT_LIST_SHOWS * 4);
    expect(split(long, list("b", 3), list("c", 2))).toEqual([["long"], ["b", "c"]]);
  });

  it("keeps a list in the first column if that's nearer half than leaving it out", () => {
    expect(split(list("a", 1), list("b", 3), list("c", 1))).toEqual([["a", "b"], ["c"]]);
    expect(split(list("a", 5), list("b", 1), list("c", 1), list("d", 1))).toEqual([["a"], ["b", "c", "d"]]);
  });

  it("puts a single list in the first column, and none in either with none", () => {
    expect(split(list("a", 2))).toEqual([["a"], []]);
    expect(split()).toEqual([[], []]);
  });
});
