import type { NextRequest } from "next/server";
import { emailBlockFilters } from "../../../../_components/email/EmailBlockFilters";
import { blockColumns } from "../../../../_components/oversight/BlocksTable";
import { filterWords } from "@/lib/staff-list-filters";
import { listBlocks } from "@/lib/oversight/blocks.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { staffDownload } from "@/lib/server/staff-download.server";
import { emailsSearch } from "@/lib/staff-search";
import { shellCopy } from "../../../../_components/shell/copy";

/**
 * Every other blocked address, and every number, the page's filters find,
 * every page, in its columns, named for its filters; each download goes in
 * the audit log, as the addresses and numbers are supporters'.
 */
export async function GET(request: NextRequest) {
  const { email } = await requireStaff("supporters");
  return staffDownload(
    request,
    email,
    async (params) => {
      const { search, filter } = emailsSearch(params);
      return {
        what: shellCopy.nav.supporterEmails,
        filters: filterWords(emailBlockFilters(true), search, "q"),
        columns: blockColumns(true),
        rows: (await listBlocks("others", filter, "all")).blocks,
      };
    },
    "download blocked emails",
  );
}
