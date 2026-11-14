import type { Metadata } from "next";
import { buttonClass } from "@/components/ui/Button";
import { now } from "@/lib/now";
import { asksWithCounts } from "@/lib/campaigns/records";
import { requireStaff } from "@/lib/accounts/auth";
import { askFormSearch } from "@/lib/staff-search";
import { firstOf, type ParamValue } from "@/lib/list-params";
import AsksList from "../../_components/campaigns/AsksList";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import StaffLink from "../../_components/ui/StaffLink";
import { campaignsCopy } from "@/lib/campaigns/copy";

export const metadata: Metadata = { title: campaignsCopy.asks.title };

export default async function AsksPage({ searchParams }: { searchParams: Promise<Record<string, ParamValue>> }) {
  await requireStaff();
  const params = await searchParams;
  const { notice } = askFormSearch(params);
  const asks = await asksWithCounts();
  return (
    <Page kind="month-list">
      <PageHead
        intro={campaignsCopy.asks.intro}
        action={
          <StaffLink className={buttonClass({ variant: "primary", fit: true })} href="/staff/asks/new">
            {campaignsCopy.asks.newTitle}
          </StaffLink>
        }
      >
        {campaignsCopy.asks.title}
      </PageHead>
      <AsksList asks={asks} now={now()} notice={notice} picked={firstOf(params.ask)} />
    </Page>
  );
}
