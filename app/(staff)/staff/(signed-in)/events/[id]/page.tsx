import type { Metadata } from "next";
import { found } from "@/lib/found";
import { now } from "@/lib/now";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { eventAudience } from "@/lib/broadcasts/event-audience.server";
import { eventPage } from "@/lib/events/event-page.server";
import { newBroadcast } from "../../../_components/broadcasts/actions";
import { BroadcastSupporters } from "../../../_components/broadcasts/BroadcastSupporters";
import EventRecord from "../../../_components/events/EventRecord";
import Page from "../../../_components/ui/Page";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const staff = await requireStaff();
  const { event } = found(await eventPage((await params).id, canSeeSupporters(staff)));
  return { title: event.name };
}

/**
 * One of our events: what the events list says of it, and for staff who see
 * supporters, its guests on Luma and the button to email those registered.
 */
export default async function EventPage({ params }: Params) {
  const staff = await requireStaff();
  const { id } = await params;
  const { event, guests } = found(await eventPage(id, canSeeSupporters(staff)));
  const audience = await eventAudience(event.id);
  return (
    <Page kind="record" under="events" here={event.name}>
      <EventRecord
        event={event}
        guests={guests}
        now={now()}
        broadcast={<BroadcastSupporters search={audience.search} total={audience.total} action={newBroadcast} />}
      />
    </Page>
  );
}
