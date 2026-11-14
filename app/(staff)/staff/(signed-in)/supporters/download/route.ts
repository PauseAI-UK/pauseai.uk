import type { NextRequest } from "next/server";
import { supporterWords } from "../../../_components/supporters/SupporterFilters";
import { supporterColumns, supporterContact } from "../../../_components/supporters/SupportersTable";
import { requireStaff } from "@/lib/accounts/auth.server";
import { staffDownload } from "@/lib/server/staff-download.server";
import { listSupporters, supporterChoices } from "@/lib/supporters/records.server";
import { supportersSearch } from "@/lib/staff-search";
import { supportersCopy } from "../../../_components/supporters/copy";

/**
 * Every supporter the list's filters find, in the list's columns, named
 * for its filters; each download goes in the audit log.
 */
export async function GET(request: NextRequest) {
  const { email } = await requireStaff("supporters");
  return staffDownload(
    request,
    email,
    async (params) => {
      const { filter, ...search } = supportersSearch(params);
      const [{ supporters, near }, choices] = await Promise.all([
        listSupporters({ ...filter, page: 1 }, null),
        supporterChoices(),
      ]);
      return {
        what: supportersCopy.supporters.title,
        filters: supporterWords(search, choices, near),
        columns: supporterColumns(search),
        rows: supporters,
        contact: supporterContact(search),
      };
    },
    "download supporters",
  );
}
