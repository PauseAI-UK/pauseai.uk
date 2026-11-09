import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { staffCopy } from "@/lib/content/staff-interface";
import { broadcastsPage } from "@/lib/server/broadcast-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import { firstOf, mailingId, type ParamValue } from "@/lib/staff-search";
import BroadcastsOverview from "../../_components/BroadcastsOverview";
import PageTitle from "../../_components/ui/PageTitle";
import Strip from "../../_components/ui/Strip";

export const metadata: Metadata = { title: staffCopy.broadcastPages.title };

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
    <>
      <Strip tone="amber">{staffCopy.broadcastPages.noBackend}</Strip>
      <PageTitle
        intro={staffCopy.broadcastPages.intro}
        action={
          <ButtonLink variant="primary" fit href="/staff/broadcasts/new">
            {staffCopy.broadcastPages.newBroadcast}
          </ButtonLink>
        }
      >
        {staffCopy.broadcastPages.title}
      </PageTitle>
      <BroadcastsOverview {...await broadcastsPage()} pulse={pulse} />
    </>
  );
}
