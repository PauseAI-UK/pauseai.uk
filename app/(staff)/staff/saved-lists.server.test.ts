import { expect, it } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { query } from "@/lib/server/db.server";
import { createSavedFilter } from "@/lib/server/saved-filters.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { openSavedList } from "./saved-lists.server";
import { eventsCopy } from "@/lib/events/copy";
import { supportersCopy } from "./_components/supporters/copy";
import { politiciansCopy } from "./_components/politicians/copy";

const JO = "jo@pauseai.uk";

describeWithDatabase("openSavedList", () => {
  useTestDatabase();

  it("loads the saved filter its link names, reads what it finds, and titles the page with what's on", async () => {
    // Its values are those still in the log.
    await query("INSERT INTO audit_log (actor, action, details) VALUES ('sync', 'sync politicians', '{}')");
    const id = await createSavedFilter("audit-log", "Sync's", { actor: "sync" }, JO);
    const log = await openSavedList("audit-log", { actor: "sync", saved: String(id) });
    expect(log.saved.loaded?.name).toBe("Sync's");
    expect([log.search.actor, log.search.filter.actor]).toEqual([["sync"], ["sync"]]);
    expect(await log.title((search) => [`Who: ${search.actor.join(", ")}`])).toBe(
      staffVocabulary.filters.pageTitle(staffCopy.changes.title, "Who: sync"),
    );
  });

  it("titles each list's page, with words worked out later or none", async () => {
    const words = async (search: { q: string }) => [search.q];
    expect(await (await openSavedList("politicians", { q: "jo" })).title(words)).toBe(
      staffVocabulary.filters.pageTitle(politiciansCopy.politicians.title, "jo"),
    );
    expect(await (await openSavedList("supporters", { q: "jo" })).title(words)).toBe(
      staffVocabulary.filters.pageTitle(supportersCopy.supporters.title, "jo"),
    );
    expect(await (await openSavedList("events", {})).title(() => [])).toBe(eventsCopy.events.title);
  });
});
