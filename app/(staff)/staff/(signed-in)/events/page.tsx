import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { eventsPage } from "@/lib/server/staff-events";
import { canSeeSupporters, requireStaff } from "@/lib/server/staff-auth";
import { type EventsSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { saveEventNow } from "../../actions";
import { deleteFilter, renameFilter, saveFilter, updateFilter } from "../../saved-filter-actions";
import { openSavedList } from "../../saved-lists";
import EventFilters, { eventWords } from "../../_components/EventFilters";
import { EventsList } from "../../_components/EventColumns";
import { EventsIntro, EventTabs } from "../../_components/EventsTable";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";

type Params = Partial<EventsSearch> & { view?: ParamValue };
type Props = { searchParams: Promise<Params> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const hosts = canSeeSupporters(await requireStaff());
  const list = await openSavedList("events", await searchParams);
  return { title: await list.title(async (search) => eventWords(search, await eventsPage(search.filter, hosts))) };
}

/**
 * Our events, to come or past, filtered, in a table or in lists by owner or
 * by tag, each with its owner and Google Doc, and its hosts for those who see
 * supporters.
 */
export default async function EventsPage({ searchParams }: Props) {
  const hosts = canSeeSupporters(await requireStaff());
  const {
    saved,
    search: { filter, ...search },
  } = await openSavedList("events", await searchParams);
  const { events, total, pages, removed, staff, tags, cities, now } = await eventsPage(filter, hosts);
  return (
    <Page kind="list">
      <PageHead intro={<EventsIntro />}>{staffCopy.events.title}</PageHead>
      <EventTabs search={search} />
      <EventFilters
        search={search}
        choices={{ staff, tags, cities }}
        saved={{
          state: saved,
          actions: { save: saveFilter, update: updateFilter, rename: renameFilter, remove: deleteFilter },
        }}
      />
      <EventsList
        found={{ events, total, pages, removed }}
        search={search}
        staff={staff}
        now={now}
        save={saveEventNow}
        hosts={hosts}
      />
    </Page>
  );
}
