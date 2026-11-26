import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { query } from "@/lib/server/db.server";
import { shownCoverage } from "./coverage.server";

describeWithDatabase("shownCoverage", () => {
  useTestDatabase();

  it("lists the pieces shown, newest first and undated last, each with only the address and date it has", async () => {
    await query("INSERT INTO press_outlets (id, name) VALUES (1, 'The Example Gazette'), (2, 'Example TV')");
    await query(
      `INSERT INTO press_coverage (outlet_id, title, medium, url, links, published, state, created_by) VALUES
         (1, 'Older', 'Article', 'https://www.examplegazette.co.uk/older', NULL, '2026-09-01', 'shown', 'test'),
         (2, 'Undated, added first', 'Video', 'https://www.example.tv/first', NULL, NULL, 'shown', 'test'),
         (1, 'Taken off', 'Article', 'https://www.examplegazette.co.uk/off', NULL, '2026-10-01', 'removed', 'test'),
         (2, 'Cross-posted', 'Video', NULL, '[{"label": "YouTube", "url": "https://www.youtube.com/watch?v=x"}]',
           '2026-09-20', 'shown', 'test'),
         (1, 'Undated, added next', 'Article', 'https://www.examplegazette.co.uk/next', NULL, NULL, 'shown', 'test')`,
    );
    expect(await shownCoverage()).toStrictEqual([
      {
        id: 4,
        outlet: "Example TV",
        title: "Cross-posted",
        medium: "Video",
        links: [{ label: "YouTube", url: "https://www.youtube.com/watch?v=x" }],
        date: "2026-09-20",
      },
      {
        id: 1,
        outlet: "The Example Gazette",
        title: "Older",
        medium: "Article",
        url: "https://www.examplegazette.co.uk/older",
        date: "2026-09-01",
      },
      {
        id: 2,
        outlet: "Example TV",
        title: "Undated, added first",
        medium: "Video",
        url: "https://www.example.tv/first",
      },
      {
        id: 5,
        outlet: "The Example Gazette",
        title: "Undated, added next",
        medium: "Article",
        url: "https://www.examplegazette.co.uk/next",
      },
    ]);
  });
});
