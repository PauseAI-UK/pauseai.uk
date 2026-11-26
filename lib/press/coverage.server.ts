import "server-only";
import { query } from "@/lib/server/db.server";
import type { CoverageItem, Medium } from "./coverage";

type Row = {
  id: number;
  outlet: string;
  title: string;
  medium: Medium;
  url: string | null;
  links: { label: string; url: string }[] | null;
  date: string | null;
};

/** The coverage /press lists: every piece shown, newest first, undated pieces last in the order they were added. */
export async function shownCoverage(): Promise<CoverageItem[]> {
  const rows = await query<Row>(
    `SELECT c.id::int AS id, o.name AS outlet, c.title, c.medium, c.url, c.links,
            to_char(c.published, 'YYYY-MM-DD') AS date
       FROM press_coverage c JOIN press_outlets o ON o.id = c.outlet_id
      WHERE c.state = 'shown'
      ORDER BY c.published DESC NULLS LAST, c.id`,
  );
  return rows.map(({ url, links, date, ...row }) => ({
    ...row,
    ...(url !== null && { url }),
    ...(links !== null && { links }),
    ...(date !== null && { date }),
  }));
}
