import { staffCopy } from "@/lib/content/staff-interface";
import { pagePath } from "@/lib/list-params";
import type { ErrorSeen } from "@/lib/server/errors-seen";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { staffTime } from "@/lib/staff-time";
import ListFrame, { type ListColumn } from "./ui/ListFrame";
import PageIntro from "./ui/PageIntro";
import StaffLink from "./ui/StaffLink";

const PATH = ERRORS_LIST.path;
const copy = staffCopy.errorsSeen;

const columns: ListColumn<ErrorSeen>[] = [
  { key: "last", label: copy.columns.last, short: true, cell: (error) => staffTime(error.lastSeen) },
  {
    key: "what",
    label: copy.columns.what,
    cell: (error) => <StaffLink href={`${PATH}/${error.id}`}>{error.words}</StaffLink>,
  },
  { key: "kind", label: copy.columns.kind, cell: (error) => copy.kinds[error.kind] },
  { key: "page", label: copy.columns.page, cell: (error) => error.route },
  { key: "first", label: copy.columns.first, short: true, cell: (error) => staffTime(error.firstSeen) },
  { key: "count", label: copy.columns.count, short: true, cell: (error) => error.count },
];

/**
 * What has gone wrong on the site outside a job's run, for admins
 * (lib/server/errors-seen.ts): a row for each error, the one seen most
 * recently first, its words leading to its own page.
 */
export default function ErrorsSeen({
  errors,
  total,
  pages,
  page,
  pageSize,
}: {
  errors: ErrorSeen[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
}) {
  return (
    <>
      <h1>{staffCopy.nav.errors}</h1>
      <PageIntro>{copy.intro}</PageIntro>
      <ListFrame
        count={copy.total(total)}
        total={total}
        page={page}
        pages={pages}
        pageSize={pageSize}
        href={(n) => pagePath(PATH, n)}
        columns={columns}
        rows={errors}
        rowKey={(error) => error.id}
        empty={copy.none}
      />
    </>
  );
}
