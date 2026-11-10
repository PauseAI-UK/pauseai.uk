import type { Metadata } from "next";
import type { ReactNode } from "react";
import { staffCopy } from "@/lib/content/staff-interface";
import { eventsPage, eventsToCome } from "@/lib/server/staff-events";
import { canSeeSupporters, requireStaff } from "@/lib/server/staff-auth";
import type { EventGrouping } from "@/lib/staff-events-list";
import { eventsSearch, eventView, type EventsSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { saveEventNow } from "../../actions";
import { deleteFilter, renameFilter, saveFilter, updateFilter } from "../../saved-filter-actions";
import { openSavedList } from "../../saved-lists";
import EventColumns from "../../_components/EventColumns";
import EventFilters, { eventWords } from "../../_components/EventFilters";
import EventsTable, { EventsSource, EventTabs } from "../../_components/EventsTable";
import PageTitle from "../../_components/ui/PageTitle";

type Params = Partial<EventsSearch> & { view?: ParamValue };
type Props = { searchParams: Promise<Params> };

/** The table's title, with its filters. */
async function tableTitle(params: Params, hosts: boolean): Promise<string> {
  const list = await openSavedList("events", params);
  return list.title(async (search) => eventWords(search, await eventsPage(search.filter, hosts)));
}

/** The By owner and By tag tabs' title: they have no filters, whatever the URL says. */
const groupedTitle = async () => staffCopy.events.title;

const TITLES = { owner: groupedTitle, tag: groupedTitle, table: tableTitle };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const hosts = canSeeSupporters(await requireStaff());
  const params = await searchParams;
  return { title: await TITLES[eventView(params)](params, hosts) };
}

/** Our events, to come or past, filtered, each with its owner and Google Doc, and its hosts for those who see supporters. */
async function Table({ params, hosts }: { params: Params; hosts: boolean }) {
  const {
    saved,
    search: { filter, ...search },
  } = await openSavedList("events", params);
  const { events, total, pages, removed, staff, tags, cities, now } = await eventsPage(filter, hosts);
  return (
    <>
      <EventTabs search={search} />
      <EventFilters
        search={search}
        choices={{ staff, tags, cities }}
        saved={{
          state: saved,
          actions: { save: saveFilter, update: updateFilter, rename: renameFilter, remove: deleteFilter },
        }}
      />
      <EventsTable
        found={{ events, total, pages, removed }}
        search={search}
        staff={staff}
        now={now}
        save={saveEventNow}
        hosts={hosts}
      />
    </>
  );
}

/** Every event to come, in lists by owner or by tag, with no filters, whatever the URL says. */
async function Grouped({ grouping }: { grouping: EventGrouping }) {
  const { events, staff } = await eventsToCome();
  return (
    <>
      <EventTabs search={eventsSearch({})} grouping={grouping} />
      <EventColumns events={events} grouping={grouping} staff={staff} save={saveEventNow} />
    </>
  );
}

const VIEWS: Record<EventGrouping | "table", (props: { params: Params; hosts: boolean }) => ReactNode> = {
  owner: () => <Grouped grouping="owner" />,
  tag: () => <Grouped grouping="tag" />,
  table: (props) => <Table {...props} />,
};

/** Each tab's view of our events, under the page's title. */
export default async function EventsPage({ searchParams }: Props) {
  const hosts = canSeeSupporters(await requireStaff());
  const params = await searchParams;
  return (
    <>
      <PageTitle action={<EventsSource />}>{staffCopy.events.title}</PageTitle>
      {VIEWS[eventView(params)]({ params, hosts })}
    </>
  );
}
