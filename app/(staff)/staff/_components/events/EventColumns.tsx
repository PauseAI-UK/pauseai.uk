import type { StaffEvent } from "@/lib/events/staff-events.server";
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
} from "@/lib/events/list";
import { among } from "@/lib/list-params";
import type { EventsSearch } from "@/lib/staff-search";
import AlertIcon from "../ui/AlertIcon";
import { EventEdit, EventsEditing, type SaveEvent } from "./EventEdit";
import EventsTable, { Missing } from "./EventsTable";
import Empty from "../ui/Empty";
import ExternalLink from "../ui/ExternalLink";
import Grid, { Card, Column } from "../ui/Grid";
import Rows, { Row } from "../ui/Rows";
import { londonDate } from "@/lib/staff-time";
import styles from "./EventColumns.module.css";
import { eventsCopy } from "@/lib/events/copy";

const copy = eventsCopy.events;

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
 * A list of events, a card: its title what they share, with how many at its
 * right; a row each, its first few, the rest in a fold. `noOwner` for the list
 * of those with no owner, in red when one of them still needs one (`needed`).
 * `where` tells this list's Edit bubbles from those of the same event in
 * another, and names its card.
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
    <Row
      key={event.id}
      lead={<span className={styles.day}>{londonDate(event.startAt)}</span>}
      second={
        <span className={styles.detail}>
          <Detail event={event} grouping={grouping} list={list.title} needed={needed(event)} />
          <span>{copy.lists.going(event.going)}</span>
          {event.doc && <ExternalLink href={event.doc}>{copy.doc}</ExternalLink>}
        </span>
      }
      end={
        <span className={styles.edit}>
          <EventEdit event={event} staff={staff} save={save} where={where} />
        </span>
      }
    >
      <ExternalLink href={event.url}>{event.name}</ExternalLink>
    </Row>
  );
  return (
    <Card
      id={`events-${where}title`}
      title={
        <span className={noOwner ? `${styles.title} ${styles.noOwner}` : styles.title}>
          {noOwner && <AlertIcon tone="red" />}
          {list.title}
        </span>
      }
      action={<span className={styles.count}>{list.events.length}</span>}
    >
      <Rows>{list.events.slice(0, EVENT_LIST_SHOWS).map(line)}</Rows>
      {list.events.length > EVENT_LIST_SHOWS && (
        <details className={styles.more}>
          <summary>{copy.lists.more(list.events.length - EVENT_LIST_SHOWS)}</summary>
          <Rows>{list.events.slice(EVENT_LIST_SHOWS).map(line)}</Rows>
        </details>
      )}
    </Card>
  );
}

/**
 * What the tab and filters find, `events`, in lists by owner or by tag, each a
 * card, in the tab's order, in two columns, each half the grid, one column below its
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
  if (events.length === 0) return <Empty>{copy.noneFound}</Empty>;
  const lists = grouping === "owner" ? eventsByOwner(events) : eventsByTag(events);
  const needed = (event: StaffEvent) => ownerNeeded(event, now);
  return (
    <EventsEditing>
      <p className={styles.found}>
        <strong>{copy.total(events.length)}</strong>
      </p>
      <Grid>
        {eventListColumns(lists).map((column, i) => (
          <Column key={i} span={3}>
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
          </Column>
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
