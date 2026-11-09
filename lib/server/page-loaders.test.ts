import { beforeEach, expect, it, vi } from "vitest";
import { eventsSearch } from "@/lib/staff-search";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { newRequest } from "@/tests/request-cache";
import { askToEdit, listAsks } from "./asks";
import { getCampaignSummary } from "./campaigns";
import { query } from "./db";
import { getPauseaiLetter, getSupporterLetter } from "./letters";
import { getPolitician, listParties } from "./politicians";
import { savedFiltersState } from "./saved-filters";
import { eventsPage } from "./staff-events";
import { getSupporter, supporterChoices } from "./supporters";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: (await import("@/tests/request-cache")).cache,
}));
vi.mock("./db", async (original) => {
  const db = await original<typeof import("./db")>();
  return { ...db, query: vi.fn(db.query) };
});

const queries = () => vi.mocked(query).mock.calls.length;

// What each staff page loads both for its metadata and for itself, each call
// with its own objects, as Next passes each its own search parameters.
const PAGES: [string, () => Promise<unknown>][] = [
  ["a politician's", () => getPolitician(1)],
  ["an ask's form", () => askToEdit("deepmind-letter")],
  ["a campaign's", () => getCampaignSummary("deepmind-letter")],
  ["a supporter's, their letters' and their erasure's", () => getSupporter(1)],
  ["a supporter's letter's", () => getSupporterLetter(1)],
  ["a mailing's letter's", () => getPauseaiLetter(1, 1)],
  ["the supporters list's", () => Promise.all([savedFiltersState("supporters", {}), supporterChoices()])],
  ["the politicians list's", () => Promise.all([savedFiltersState("politicians", {}), listAsks(), listParties()])],
  [
    "the events page's",
    async () => {
      await savedFiltersState("events", {});
      return eventsPage(eventsSearch({}).filter, true);
    },
  ],
];

describeWithDatabase("the staff pages' loaders", () => {
  useTestDatabase();
  beforeEach(newRequest);

  it.each(PAGES)("query %s data once a request, for its metadata and the page both", async (_, load) => {
    const before = queries();
    await load();
    const once = queries() - before;
    expect(once).toBeGreaterThan(0);
    await load();
    expect(queries() - before).toBe(once);
    newRequest();
    await load();
    expect(queries() - before).toBe(2 * once);
  });
});
