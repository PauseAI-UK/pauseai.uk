import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { pageNumber, type ParamValue } from "@/lib/list-params";
import { listErrorsSeen } from "@/lib/server/errors-seen";
import { requireStaff } from "@/lib/server/staff-auth";
import { ERRORS_LIST } from "@/lib/staff-lists";
import ErrorsSeen from "../../_components/ErrorsSeen";

export const metadata: Metadata = { title: staffCopy.nav.errors };

/** What has gone wrong on the site outside a job's run, the one seen most recently first. */
export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<string, ParamValue>>>;
}) {
  await requireStaff("admin");
  const { page } = ERRORS_LIST.read(await searchParams);
  return <ErrorsSeen {...await listErrorsSeen(pageNumber(page))} />;
}
