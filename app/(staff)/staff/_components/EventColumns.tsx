import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { StaffEvent } from "@/lib/server/staff-events";
import {
  EVENT_LIST_SHOWS,
  eventListColumns,
  eventsByOwner,
  eventsByTag,
  ownerNeeded,
  EVENT_GROUPINGS,
  type EventGrouping,
  type EventList,
  type EventsFound,
} from "@/lib/staff-events-list";
import { among } from "@/lib/list-params";
import type { EventsSearch } from "@/lib/staff-search";
import AlertIcon from "./AlertIcon";
import { EventEdit, EventsEditing, type SaveEvent } from "./EventEdit";
import EventsTable, { Missing } from "./EventsTable";
import ExternalLink from "./ui/ExternalLink";
import Grid, { spanClass } from "./ui/Grid";
import { londonDate } from "@/lib/staff-time";
import styles from "./EventColumns.module.css";

const copy = staffCopy.events;

/**
 * What a line says beyond its list's heading. By owner: its tags, or its city,
 * or that it's online. By tag: who owns it, in red if no one does and one's
 * `needed`, and its other tags.
 */
function Detail({
  event,
  grouping,
  list,
  needed,
}: {
  event: StaffEvent;
  grouping: EventGrouping;
  list: string;
  needed: boolean;
}) {
  if (grouping === "owner") return <span>{event.tags.join(", ") || event.city || copy.online}</span>;
  const others = event.tags.filter((tag) => tag !== list);
  return (
    <>
      {event.owner ? <strong>{event.owner}</strong> : <Missing needed={needed}>{copy.noOwner}</Missing>}
      {others.length > 0 && <span>{copy.lists.also(others.join(", "))}</span>}
    </>
  );
}

/**
 * A list of events under a heading with how many: its first few, the rest in a
 * fold. `noOwner` for the list of those with no owner, in red when one of them
 * still needs one (`needed`). `where` tells this list's Edit bubbles from those
 * of the same event in another.
 */
function List({
  list,
  noOwner,
  needed,
  grouping,
  where,
  staff,
  save,
}: {
  list: EventList;
  noOwner: boolean;
  needed: (event: StaffEvent) => boolean;
  grouping: EventGrouping;
  where: string;
  staff: readonly string[];
  save: SaveEvent;
}) {
  const line = (event: StaffEvent) => (
    <li key={event.id} className={styles.line}>
      <span>{londonDate(event.startAt)}</span>
      <span className={styles.name}>
        <ExternalLink href={event.url}>{event.name}</ExternalLink>
        <span className={styles.detail}>
          <Detail event={event} grouping={grouping} list={list.title} needed={needed(event)} />
          <span>{copy.lists.going(event.going)}</span>
          {event.doc && <ExternalLink href={event.doc}>{copy.doc}</ExternalLink>}
        </span>
      </span>
      <EventEdit event={event} staff={staff} save={save} where={where} />
    </li>
  );
  return (
    <section className={noOwner ? `${styles.list} ${styles.noOwner}` : styles.list}>
      <h2 className={styles.heading}>
        <span className={styles.title}>
          {noOwner && <AlertIcon tone="red" />}
          {list.title}
        </span>
        <span className={styles.count}>{list.events.length}</span>
      </h2>
      <ul>{list.events.slice(0, EVENT_LIST_SHOWS).map(line)}</ul>
      {list.events.length > EVENT_LIST_SHOWS && (
        <details>
          <summary>{copy.lists.more(list.events.length - EVENT_LIST_SHOWS)}</summary>
          <ul>{list.events.slice(EVENT_LIST_SHOWS).map(line)}</ul>
        </details>
      )}
    </section>
  );
}

/**
 * What the tab and filters find, `events`, in lists by owner or by tag, in the
 * tab's order, in two columns, each half the grid, one column below its
 * breakpoint, under how many there are. Any staff
 * member can change an event's owner and doc, from its Edit button. An event in
 * two lists is listed in full in each. An event to come on Luma with no owner,
 * at `now`, is an error.
 */
export default function EventColumns({
  events,
  grouping,
  staff,
  now,
  save,
}: {
  events: StaffEvent[];
  grouping: EventGrouping;
  staff: readonly string[];
  now: Date;
  save: SaveEvent;
}) {
  if (events.length === 0) return <Muted>{copy.noneFound}</Muted>;
  const lists = grouping === "owner" ? eventsByOwner(events) : eventsByTag(events);
  const needed = (event: StaffEvent) => ownerNeeded(event, now);
  return (
    <EventsEditing>
      <p className={styles.found}>
        <strong>{copy.total(events.length)}</strong>
      </p>
      <Grid>
        {eventListColumns(lists).map((column, i) => (
          <div key={i} className={spanClass(3)}>
            {column.map((list) => (
              <List
                key={list.title}
                list={list}
                noOwner={grouping === "owner" && list.title === copy.noOwner && list.events.some(needed)}
                needed={needed}
                grouping={grouping}
                where={`${lists.indexOf(list)}-`}
                staff={staff}
                save={save}
              />
            ))}
          </div>
        ))}
      </Grid>
    </EventsEditing>
  );
}

/**
 * What the tab and filters find, as the URL asks: in lists by its grouping, or
 * a table (EventsTable).
 */
export function EventsList(props: {
  found: EventsFound;
  search: EventsSearch;
  staff: readonly string[];
  now: Date;
  save: SaveEvent;
  hosts: boolean;
}) {
  const { found, search, staff, now, save } = props;
  const grouping = among([search.group], EVENT_GROUPINGS)[0];
  if (!grouping) return <EventsTable {...props} />;
  return <EventColumns events={found.events} grouping={grouping} staff={staff} now={now} save={save} />;
}
