import type { NextRequest } from "next/server";
import { politicianWords } from "../../../_components/politicians/PoliticianFilters";
import { politicianColumns, politicianContact } from "../../../_components/politicians/PoliticianTable";
import { listAsks } from "@/lib/asks/records";
import { listParties, listPoliticians } from "@/lib/politicians/records";
import { politiciansSearch } from "@/lib/staff-search";
import { requireStaff } from "@/lib/accounts/auth";
import { staffDownload } from "@/lib/server/staff-download";
import { politiciansCopy } from "../../../_components/politicians/copy";

/** Every politician the list's filters find, in the columns the list shows, named for its house and filters. */
export async function GET(request: NextRequest) {
  const { email } = await requireStaff();
  return staffDownload(request, email, async (params) => {
    const { filter, ...search } = politiciansSearch(params);
    const [politicians, asks, parties] = await Promise.all([
      listPoliticians({ ...filter, page: 1 }, null),
      listAsks(),
      listParties(),
    ]);
    const filters = { ...search, page: "" };
    return {
      what: politiciansCopy.politicians.title,
      filters: politicianWords(search, parties, asks),
      columns: politicianColumns(asks, filters),
      rows: politicians,
      contact: politicianContact(asks),
    };
  });
}
