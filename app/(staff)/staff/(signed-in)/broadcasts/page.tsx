import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { broadcastsPage } from "@/lib/broadcasts/pages.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { mailingId } from "@/lib/staff-search";
import { firstOf, type ParamValue } from "@/lib/list-params";
import BroadcastsOverview from "../../_components/broadcasts/BroadcastsOverview";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

export const metadata: Metadata = { title: broadcastsCopy.broadcastPages.title };

/**
 * Broadcasts, emails and texts to supporters, together. New broadcast asks
 * which Consent it goes under, as that says how it goes and what it's about.
 * `submitted` is a draft whose words were just sent to WhatsApp from its
 * page, which came back here; its row pulses.
 */
export default async function BroadcastsPage({ searchParams }: { searchParams: Promise<{ submitted?: ParamValue }> }) {
  await requireStaff("supporters");
  const pulse = mailingId(firstOf((await searchParams).submitted));
  return (
    <Page kind="month-list">
      <PageHead
        intro={broadcastsCopy.broadcastPages.intro}
        action={
          <ButtonLink variant="primary" fit href="/staff/broadcasts/new">
            {broadcastsCopy.broadcastPages.newBroadcast}
          </ButtonLink>
        }
      >
        {broadcastsCopy.broadcastPages.title}
      </PageHead>
      <BroadcastsOverview {...await broadcastsPage()} pulse={pulse} />
    </Page>
  );
}
