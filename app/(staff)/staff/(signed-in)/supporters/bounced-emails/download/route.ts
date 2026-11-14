import type { NextRequest } from "next/server";
import { emailBlockFilters } from "../../../../_components/email/EmailBlockFilters";
import { blockColumns } from "../../../../_components/oversight/EmailBlocksTable";
import { filterWords } from "@/lib/staff-list-filters";
import { listBlocks } from "@/lib/email/email.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { staffDownload } from "@/lib/server/staff-download.server";
import { emailsSearch } from "@/lib/staff-search";
import { supportersCopy } from "../../../../_components/supporters/copy";

/**
 * Every other blocked address the page's filters find, in its columns,
 * named for its filters; each download goes in the audit log, as the
 * addresses are supporters'.
 */
export async function GET(request: NextRequest) {
  const { email } = await requireStaff("supporters");
  return staffDownload(
    request,
    email,
    async (params) => {
      const { q, kind, filter } = emailsSearch(params);
      return {
        what: supportersCopy.bouncedEmails.title,
        filters: filterWords(emailBlockFilters(), { q, kind }, "q"),
        columns: blockColumns(true),
        rows: await listBlocks("others", filter),
      };
    },
    "download blocked emails",
  );
}
