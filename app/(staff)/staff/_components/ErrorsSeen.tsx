import { staffCopy } from "@/lib/content/staff-interface";
import { filtersPath, pageParam } from "@/lib/list-params";
import type { ErrorSeen } from "@/lib/server/errors-seen";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { staffTime } from "@/lib/staff-time";
import ListFrame, { type ListColumn } from "./ui/ListFrame";
import PageIntro from "./ui/PageIntro";
import StaffLink from "./ui/StaffLink";
import Tabs from "./ui/Tabs";

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

/** The Done tab's: who marked each done, and when, after the rest. */
const doneColumns: ListColumn<ErrorSeen>[] = [
  ...columns,
  { key: "doneBy", label: copy.columns.doneBy, cell: (error) => error.doneBy },
  { key: "doneAt", label: copy.columns.doneAt, short: true, cell: (error) => staffTime(error.doneAt!) },
];

/**
 * What has gone wrong on the site outside a job's run, for admins
 * (lib/server/errors-seen.ts): in two tabs, those to do and those marked
 * done (`done`), a row for each error, the one seen most recently first,
 * its words leading to its own page.
 */
export default function ErrorsSeen({
  done,
  errors,
  total,
  pages,
  page,
  pageSize,
}: {
  done: boolean;
  errors: ErrorSeen[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
}) {
  const tab = { done: done ? "yes" : "" };
  return (
    <>
      <h1>{staffCopy.nav.errors}</h1>
      <PageIntro>{copy.intro}</PageIntro>
      <Tabs
        label={copy.tabs.label}
        current={done ? "done" : "toDo"}
        tabs={[
          { key: "toDo", label: copy.tabs.toDo, href: PATH },
          { key: "done", label: copy.tabs.done, href: filtersPath(PATH, { done: "yes" }) },
        ]}
      />
      <ListFrame
        count={copy.total(total)}
        total={total}
        page={page}
        pages={pages}
        pageSize={pageSize}
        href={(n) => filtersPath(PATH, tab, pageParam(n))}
        columns={done ? doneColumns : columns}
        rows={errors}
        rowKey={(error) => error.id}
        empty={done ? copy.noneDone : copy.none}
      />
    </>
  );
}
