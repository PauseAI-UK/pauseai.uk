import { describe, expect, it } from "vitest";
import { staffPageOf } from "./staff-sections";
import {
  ACCOUNTS_LIST,
  ALL_EMAILS_LIST,
  AUDIT_LOG_LIST,
  clearedPath,
  defineStaffList,
  EVENTS_LIST,
  LETTERS_LIST,
  POLITICIANS_LIST,
  SENT_EMAILS_LIST,
  SUPPORTERS_LIST,
} from "./staff-lists";

describe("a staff list's definition", () => {
  const list = defineStaffList({
    path: "/staff/things",
    needs: "admin",
    params: { q: "one", tag: "many", tab: "one", sort: "one", dir: "one", page: "one" },
    choosing: ["q", "tag"],
    kept: ["tab"],
    sorts: { columns: { name: "asc", added: "desc" }, fallback: "added" },
  });

  it("reads its URL, a blank for what's missing and every value of one that repeats", () => {
    expect(list.read({ q: ["first", "second"], tag: "a", page: "2", other: "x" })).toEqual({
      q: "first",
      tag: ["a"],
      tab: "",
      sort: "",
      dir: "",
      page: "2",
    });
    expect(list.read({}).tag).toEqual([]);
  });

  it("sorts by a column it has, or its fallback, each in its natural direction unless the URL says", () => {
    expect(list.sort({ sort: "name", dir: "" })).toEqual({ key: "name", dir: "asc" });
    expect(list.sort({ sort: "name", dir: "desc" })).toEqual({ key: "name", dir: "desc" });
    expect(list.sort({ sort: "nonsense" })).toEqual({ key: "added", dir: "desc" });
    expect(list.columns).toEqual({ name: "asc", added: "desc" });
  });

  it("keeps in a saved filter its tab, what it shows, and its sort", () => {
    expect(list.saved).toEqual(["tab", "q", "tag", "sort", "dir"]);
  });

  it("has no columns, nothing chosen and nothing kept, when its definition gives none", () => {
    expect(EVENTS_LIST.columns).toEqual({});
    expect(ACCOUNTS_LIST.choosing).toEqual([]);
    expect(ACCOUNTS_LIST.saved).toEqual(["sort", "dir"]);
  });

  it("clears to its URL with only what's kept, and has nothing to clear with no search, filter or saved filter on", () => {
    expect(clearedPath(list, { tab: "old", sort: "name", page: "2" }, ["tab"])).toBeUndefined();
    expect(clearedPath(list, { q: "ann", tag: ["a", "b"], tab: "old", sort: "name" }, ["tab"])).toBe(
      "/staff/things?tab=old",
    );
    expect(clearedPath(list, { tag: ["a"] })).toBe("/staff/things");
    // A saved filter that's loaded is one to clear, even one that filters by nothing.
    expect(clearedPath(list, { saved: "7" }, ["tab"])).toBe("/staff/things");
    // What's kept isn't a filter that's on, though the list counts it as choosing what it shows.
    expect(clearedPath({ path: "/staff/things", choosing: ["q", "tab"] }, { tab: "old" }, ["tab"])).toBeUndefined();
  });

  it("keeps the events list's tab and grouping in a saved filter, and the audit log's filters and sort", () => {
    expect(EVENTS_LIST.saved.slice(0, 2)).toEqual(["when", "group"]);
    expect(AUDIT_LOG_LIST.saved).toEqual(["q", "actor", "action", "when", "sort", "dir"]);
  });
});

it("gives each list the permission its page's place in the navigation needs, as its page asks for", () => {
  const lists = [
    POLITICIANS_LIST,
    SUPPORTERS_LIST,
    EVENTS_LIST,
    AUDIT_LOG_LIST,
    LETTERS_LIST,
    SENT_EMAILS_LIST,
    ALL_EMAILS_LIST,
    ACCOUNTS_LIST,
  ];
  const wrong = lists.filter((list) => list.needs !== (staffPageOf(list.path)?.permission ?? "account"));
  expect(wrong.map((list) => list.path)).toEqual([]);
});
