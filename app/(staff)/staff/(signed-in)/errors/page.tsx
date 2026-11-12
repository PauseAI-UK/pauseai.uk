import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { pageNumber, type ParamValue } from "@/lib/list-params";
import { listErrorsSeen } from "@/lib/server/errors-seen";
import { requireStaff } from "@/lib/server/staff-auth";
import { ERRORS_LIST } from "@/lib/staff-lists";
import ErrorsSeen from "../../_components/ErrorsSeen";
import Page from "../../_components/ui/Page";

export const metadata: Metadata = { title: staffCopy.nav.errors };

/** What has gone wrong on the site outside a job's run, to do or done, the one seen most recently first. */
export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<string, ParamValue>>>;
}) {
  await requireStaff("admin");
  const { page, done } = ERRORS_LIST.read(await searchParams);
  const showDone = done === "yes";
  return (
    <Page kind="list">
      <ErrorsSeen done={showDone} {...await listErrorsSeen(pageNumber(page), showDone)} />
    </Page>
  );
}
