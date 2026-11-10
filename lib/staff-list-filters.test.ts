import { describe, expect, it } from "vitest";
import { staffCopy } from "./content/staff-interface";
import { listFilters, SUPPORTER_FILTERS } from "./staff-list-filters";
import { defineStaffList } from "./staff-lists";

const LIST = defineStaffList({
  path: "/staff/things",
  needs: "account",
  params: { colour: "many", size: "one", tag: "many" },
});

describe("listFilters", () => {
  it("names each filter by its parameter, in their order, one the URL gives more than once repeating unless it's chosen once", () => {
    const filters = listFilters(LIST, ({ tags }: { tags: string[] }) => ({
      size: { label: "Size", options: [] },
      colour: { label: "Colour", options: [] },
      tag: { label: "Tag", once: true, options: tags.map((value) => ({ value, label: value })) },
    }));
    expect(filters({ tags: ["red"] })).toEqual([
      { name: "size", label: "Size", options: [] },
      { name: "colour", label: "Colour", options: [], repeat: true },
      { name: "tag", label: "Tag", options: [{ value: "red", label: "red" }] },
    ]);
    // Only the list's own parameters are filters.
    // @ts-expect-error: the list has no "shape"
    listFilters(LIST, () => ({ shape: { label: "Shape", options: [] } }));
  });
});

describe("SUPPORTER_FILTERS", () => {
  const near = (found?: Parameters<typeof SUPPORTER_FILTERS>[0]["found"], text = "Leeds") =>
    SUPPORTER_FILTERS({ events: [], mps: [], near: text, found }).find((filter) => filter.name === "near")!.options;
  const copy = staffCopy.supporters.filters;

  it("says the Near filter's place as found, as typed before it's looked up, or that it couldn't be found", () => {
    expect(near({ place: "Leeds, West Yorkshire", latitude: 53.8, longitude: -1.5, country: "england" })).toEqual([
      { value: "Leeds", label: "Leeds, West Yorkshire" },
    ]);
    expect(near()).toEqual([{ value: "Leeds", label: "Leeds" }]);
    expect(near(null)).toEqual([{ value: "Leeds", label: copy.notFound("Leeds") }]);
    expect(near("failed")).toEqual([{ value: "Leeds", label: copy.failed("Leeds") }]);
    expect(near(undefined, "")).toEqual([]);
  });

  it("puts each topic of the Subscriptions filter under its channel, with the channel's icon when it's given one", () => {
    const contact = (channelIcon?: (channel: string) => string) =>
      SUPPORTER_FILTERS({ events: [], mps: [], near: "", channelIcon }).find((filter) => filter.name === "contact")!;
    expect(contact().options[0].group).toEqual({ label: copy.channels.email, icon: undefined });
    expect(contact((channel) => `icon of ${channel}`).options[0].group).toEqual({
      label: copy.channels.email,
      icon: "icon of email",
    });
    expect(contact().repeat).toBeUndefined();
  });
});
