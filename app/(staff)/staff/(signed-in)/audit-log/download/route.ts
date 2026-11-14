import type { NextRequest } from "next/server";
import { changeWords } from "../../../_components/oversight/ChangesFilters";
import { changeColumns } from "../../../_components/oversight/ChangesTable";
import { recentChanges } from "@/lib/oversight/audit-log.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { staffDownload } from "@/lib/server/staff-download.server";
import { changesSearch } from "@/lib/staff-search";
import { oversightCopy } from "@/lib/oversight/copy";

/** What the log's filters find, as much of it as this staff member may see, in the order chosen and its columns, the details as logged, named for its filters. */
export async function GET(request: NextRequest) {
  const staff = await requireStaff("admin");
  return staffDownload(request, staff.email, async (params) => {
    const { filter, ...search } = changesSearch(params);
    return {
      what: oversightCopy.changes.title,
      filters: changeWords(search),
      columns: changeColumns(),
      rows: (await recentChanges(canSeeSupporters(staff), { ...filter, page: 1 }, null)).changes,
    };
  });
}
