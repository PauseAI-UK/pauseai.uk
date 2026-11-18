import type { NextRequest } from "next/server";
import { politicianWords } from "../../../_components/politicians/PoliticianFilters";
import {
  pastedColumns,
  pastedRows,
  politicianColumns,
  politicianContact,
  type PastedRow,
} from "../../../_components/politicians/PoliticianTable";
import type { Politician } from "@/lib/politicians/records.server";
import { politiciansDownloadData } from "@/lib/mailings/pages.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { staffDownload, type Download } from "@/lib/server/staff-download.server";
import { politiciansCopy } from "../../../_components/politicians/copy";

/**
 * What the list shows, in its columns, named for its house and filters:
 * every politician its filters find, or on the ticked tab those ticked; on
 * the paste tab, a row for each person each line pasted found, and why.
 */
export async function GET(request: NextRequest) {
  const { email } = await requireStaff();
  return staffDownload(request, email, async (params) => {
    const data = await politiciansDownloadData(params);
    const { search, asks, parties } = data;
    const what = politiciansCopy.politicians.title;
    const filters = politicianWords(search, parties, asks);
    const contact = politicianContact(asks);
    if (data.kind === "pasted") {
      const pasted: Download<PastedRow> = {
        what,
        filters,
        columns: pastedColumns(asks),
        rows: pastedRows(data.pasted),
        contact: (row) => contact(row.one),
      };
      return pasted as Download<unknown>;
    }
    const listed: Download<Politician> = {
      what,
      filters,
      columns: politicianColumns(asks, { ...search, page: "" }),
      rows: data.politicians,
      contact,
    };
    return listed as Download<unknown>;
  });
}
