import type { Metadata } from "next";
import { buttonClass } from "@/components/ui/Button";
import { staffCopy } from "@/lib/content/staff-interface";
import { now } from "@/lib/now";
import { asksWithCounts } from "@/lib/server/asks";
import { requireStaff } from "@/lib/server/staff-auth";
import { askFormSearch } from "@/lib/staff-search";
import { firstOf, type ParamValue } from "@/lib/list-params";
import AsksList from "../../_components/AsksList";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import StaffLink from "../../_components/ui/StaffLink";

export const metadata: Metadata = { title: staffCopy.asks.title };

export default async function AsksPage({ searchParams }: { searchParams: Promise<Record<string, ParamValue>> }) {
  await requireStaff();
  const params = await searchParams;
  const { notice } = askFormSearch(params);
  const asks = await asksWithCounts();
  return (
    <Page kind="month-list">
      <PageHead
        intro={staffCopy.asks.intro}
        action={
          <StaffLink className={buttonClass({ variant: "primary", fit: true })} href="/staff/asks/new">
            {staffCopy.asks.newTitle}
          </StaffLink>
        }
      >
        {staffCopy.asks.title}
      </PageHead>
      <AsksList asks={asks} now={now()} notice={notice} picked={firstOf(params.ask)} />
    </Page>
  );
}
