import type { ReactNode } from "react";
import Table from "@/components/ui/Table";
import Tag, { type TagTone } from "@/components/ui/Tag";
import type { EventPage, Guest, GuestCount } from "@/lib/events/event-page.server";
import type { GuestStatus } from "@/lib/events/guests";
import { ownerNeeded } from "@/lib/events/list";
import type { StaffEvent } from "@/lib/events/staff-events-list.server";
import { phoneWords } from "@/lib/phone";
import { staffDate, staffTime } from "@/lib/staff-time";
import Band, { BandFact } from "../ui/Band";
import Counts from "../ui/Counts";
import details from "../ui/Details.module.css";
import Empty from "../ui/Empty";
import ExternalLink from "../ui/ExternalLink";
import Grid, { Card } from "../ui/Grid";
import StaffLink from "../ui/StaffLink";
import { Doc, Hosts, Owner } from "./EventsTable";
import { eventsCopy } from "./copy";

const copy = eventsCopy.events;
const words = eventsCopy.event;

/** Each status's colour, in the counts and the table: going green, awaiting approval blue, waitlisted amber, declined plain. */
const TONES: Record<GuestStatus, Extract<TagTone, "green" | "blue" | "amber"> | undefined> = {
  approved: "green",
  pending_approval: "blue",
  waitlist: "amber",
  declined: undefined,
};

/** The columns a guest may have nothing in, each shown only when a guest has something in it. */
const OPTIONAL = ["postcode", "phone", "cameFrom"] as const;

/**
 * The band at the top of an event's page: its name, tagged when it's been
 * taken off Luma; when and where it is, its tags, its owner and Google Doc,
 * its hosts for staff who see supporters, and its page on Luma; at the
 * right, how many guests have each status (`counts`), for those who see
 * them. An event still to come with no owner, at `now`, says so in red, as
 * the list does.
 */
function EventBand({ event, counts, now }: { event: StaffEvent; counts: GuestCount[] | null; now: Date }) {
  const aside = counts && (
    <Counts
      counts={counts.map(({ status, n }) => ({
        key: status,
        n,
        label: words.counted[status],
        tone: TONES[status] ?? "grey",
      }))}
    />
  );
  return (
    <Band className={details.band} title={event.name} tag={event.removed && <Tag>{copy.removed}</Tag>} aside={aside}>
      <BandFact label={copy.columns.when}>{staffTime(event.startAt)}</BandFact>
      <BandFact label={copy.columns.place}>{event.city ?? copy.online}</BandFact>
      <BandFact label={copy.columns.tags}>{event.tags.join(", ")}</BandFact>
      <BandFact label={copy.owner}>
        <Owner owner={event.owner} needed={ownerNeeded(event, now)} />
      </BandFact>
      <BandFact label={copy.doc}>
        <Doc doc={event.doc} />
      </BandFact>
      <BandFact label={copy.columns.hosts}>{event.hosts.length > 0 && <Hosts hosts={event.hosts} />}</BandFact>
      <BandFact label={words.luma}>
        <ExternalLink href={event.url}>{words.lumaLink}</ExternalLink>
      </BandFact>
    </Band>
  );
}

/** A guest's name, leading to their supporter's page once linked; their Luma email where Luma has no name. */
function GuestName({ guest }: { guest: Guest }) {
  const name = guest.name || guest.email;
  return guest.supporterId ? <StaffLink href={`/staff/supporters/${guest.supporterId}`}>{name}</StaffLink> : name;
}

/**
 * The guests Luma lists for the event, in a table, its columns in the
 * lists' order (docs/style-guide.md, "Lists"): who each one is, their
 * name, then their postcode, phone and the link they came by, each of
 * those only when a guest has one, as only some events ask; then their
 * status on Luma, with when they registered and when that last changed.
 */
function GuestsTable({ guests }: { guests: Guest[] }) {
  const shown = OPTIONAL.filter((column) => guests.some((guest) => guest[column]));
  const cell: Record<(typeof OPTIONAL)[number], (guest: Guest) => ReactNode> = {
    postcode: (guest) => guest.postcode,
    phone: (guest) => guest.phone && phoneWords(guest.phone),
    cameFrom: (guest) => guest.cameFrom,
  };
  return (
    <Table>
      <thead>
        <tr>
          <th>{words.columns.name}</th>
          {shown.map((column) => (
            <th key={column}>{words.columns[column]}</th>
          ))}
          <th>{words.columns.status}</th>
          <th>{words.columns.registered}</th>
          <th>{words.columns.changed}</th>
        </tr>
      </thead>
      <tbody>
        {guests.map((guest) => (
          <tr key={guest.id}>
            <td>
              <GuestName guest={guest} />
            </td>
            {shown.map((column) => (
              <td key={column}>{cell[column](guest)}</td>
            ))}
            <td>
              <Tag tone={TONES[guest.status]}>{words.statuses[guest.status]}</Tag>
            </td>
            <td>{staffDate(guest.registeredAt)}</td>
            <td>{staffDate(guest.changedAt)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * One of our events (eventPage): the band, then for staff who see
 * supporters (`guests`), a card of the guests Luma lists, with `broadcast`
 * at its title's right, the button to email them.
 */
export default function EventRecord({
  event,
  guests,
  counts,
  now,
  broadcast,
}: EventPage & {
  now: Date;
  broadcast: ReactNode;
}) {
  return (
    <>
      <EventBand event={event} counts={counts} now={now} />
      {guests && (
        <Grid>
          <Card span={6} title={words.guests} id="event-guests" action={broadcast}>
            {guests.length > 0 ? <GuestsTable guests={guests} /> : <Empty>{words.noGuests}</Empty>}
          </Card>
        </Grid>
      )}
    </>
  );
}
