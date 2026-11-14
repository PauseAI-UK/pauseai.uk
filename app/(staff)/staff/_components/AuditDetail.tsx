import StaffLink from "./ui/StaffLink";
import { Fragment, type ReactNode } from "react";
import { Muted } from "@/components/ui/Text";
import type { AuditAction, AuditEvent, StoredAuditDetails } from "@/lib/audit-events";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffDate } from "@/lib/staff-time";
import type { FieldChange } from "@/lib/field-changes";
import { importPath } from "@/lib/import-runs";
import { signupUploadPath } from "@/lib/signup-upload";
import type { LoggedChange, Named } from "@/lib/server/audit";
import CampaignName from "./CampaignName";
import { DotParts } from "./Logged";

const copy = staffCopy.changes;

/** A field's name, in bold before its value; one with no name in the copy, as logged, with a capital. */
function label(key: string): string {
  return (
    staffCopy.fields[key as keyof typeof staffCopy.fields] ?? copy.labels[key] ?? key[0].toUpperCase() + key.slice(1)
  );
}

/** Permissions as their names, or that there are none. */
function permissionNames(value: unknown): string {
  const list = value as string[];
  return list.length ? list.map((p) => staffCopy.accounts.names[p] ?? p).join(", ") : copy.noPermissions;
}

/** A value as words: a house, a kind of problem, a status or a campaign by name, a mark on or off; anything else as it is. */
function Value({ name, value }: { name: string; value: unknown }) {
  if (value === null) return <Muted>{copy.empty}</Muted>;
  if (name === "house") return <>{staffCopy.houses[value as string] ?? String(value)}</>;
  if (name === "campaign") return <CampaignName slug={String(value)} />;
  if (typeof value === "string") return <>{value}</>;
  // A mark, on or off.
  if (typeof value === "boolean") return <>{value ? copy.on : copy.off}</>;
  return <>{JSON.stringify(value)}</>;
}

/** What an edit changed: each field, before and after. */
export function FieldChanges({ changed }: { changed: Record<string, FieldChange> }) {
  return (
    <DotParts>
      {Object.entries(changed).map(([name, [before, after]]) => (
        <Fragment key={name}>
          <strong>{label(name)}</strong> <Value name={name} value={before} /> → <Value name={name} value={after} />
        </Fragment>
      ))}
    </DotParts>
  );
}

/** Someone the entry is about: their name linked to their page while they're here; otherwise the name it gave, or their ID. */
function Who({ named, href, name, id }: { named: Named | null; href: string; name: string; id: unknown }) {
  const shown = named?.name || name || copy.gone(String(named?.id ?? id));
  return named ? <StaffLink href={`${href}/${named.id}`}>{shown}</StaffLink> : <>{shown}</>;
}

/**
 * One logged field, labelled, in words: permissions by name, a count by
 * what it counted, and the rest as they are.
 */
function Field({ name, value }: { name: string; value: unknown }) {
  if (typeof value === "number") {
    return (
      <>
        {value} {copy.counts[name]?.(value) ?? name}
      </>
    );
  }
  let shown: ReactNode;
  if (name === "kind") shown = staffCopy.emails.kinds[String(value)] ?? String(value);
  else if (name === "status") shown = staffCopy.statuses[String(value)] ?? String(value);
  else if (name === "from" || name === "to" || name === "permissions") shown = permissionNames(value);
  else if (name === "changed") return <FieldChanges changed={value as Record<string, FieldChange>} />;
  else shown = <Value name={name} value={value} />;
  return (
    <>
      <strong>{label(name)}</strong> {shown}
    </>
  );
}

/**
 * What an entry of the audit log says, in words: first whom or what it's
 * about, linked where there's a page, then every other field it logged,
 * labelled, leaving out those with nothing in them (a null date, an empty
 * note).
 */
export default function AuditDetail({ change }: { change: LoggedChange }) {
  const { fields, parts } = leadOf(change);
  // Leaving out what has nothing in it: an empty note, a null date, a change of nothing. An empty list
  // says something ("No permissions"), so it stays.
  const empty = (value: unknown) =>
    value === null ||
    value === "" ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);
  const rest = Object.entries(change.details).filter(([key, value]) => !fields.includes(key) && !empty(value));
  return <DotParts>{[...parts, ...rest.map(([key, value]) => <Field key={key} name={key} value={value} />)]}</DotParts>;
}

/** What an entry says first, before the rest of its fields: its parts, and the fields they say. */
type Lead = { parts: ReactNode[]; fields: string[] };

/** An entry's lead, from its details as action `A` logs them. */
type LeadOf<A extends AuditAction> = (details: StoredAuditDetails[A], change: LoggedChange) => Lead;

const NO_LEAD: Lead = { parts: [], fields: [] };

/** For an action whose fields say it all. */
const none = () => NO_LEAD;

/** About a politician, by the name it gave. */
const politician: LeadOf<"add politician" | "edit politician" | "remove politician" | "delete politician"> = (
  details,
  change,
) => ({
  parts: [<Who key="about" named={change.politician} href="/staff/politicians" name={details.name} id={details.id} />],
  fields: ["id", "name"],
});

/** About a politician, and the answer set or cleared. */
const status: LeadOf<"set status"> = (details, change) => {
  const words =
    details.status === null
      ? staffCopy.politician.statusCleared
      : staffCopy.politician.statusSet(staffCopy.statuses[details.status] ?? details.status);
  return {
    parts: [
      <Who key="about" named={change.politician} href="/staff/politicians" name="" id={details.politicianId} />,
      <>
        {words.before}
        {/* By ask's slug, or, logged before asks, by campaign. */}
        {"ask" in details ? details.ask : <CampaignName slug={details.campaign} />}
        {words.after}
        {details.date && `, ${staffDate(new Date(details.date))}`}
      </>,
    ],
    fields: ["politicianId", "status", "ask", "campaign", "date"],
  };
};

/** Which note isn't said: only whom it's about. */
const note: LeadOf<"add note" | "edit note" | "delete note"> = (details, change) => ({
  parts: [
    "politicianId" in details ? (
      <Who named={change.politician} href="/staff/politicians" name="" id={details.politicianId} />
    ) : (
      <Who named={change.supporter} href="/staff/supporters" name="" id={details.supporterId} />
    ),
  ],
  fields: ["noteId", "politicianId", "supporterId"],
});

const savedFilter: LeadOf<"save filter" | "update filter" | "rename filter" | "delete filter"> = (details) => ({
  parts: [copy.savedFilter(details.list, String(details.id))],
  fields: ["id", "list"],
});

/** Logged by a body's import: the held run, on its job's page. */
const heldImport: LeadOf<"apply held politician import" | "discard held politician import"> = (details) => ({
  parts: [
    <StaffLink key="run" href={importPath(details.job)}>
      {copy.run(String(details.id))}
    </StaffLink>,
  ],
  fields: ["id", "job"],
});

/** Logged by the copy from Airtable, or before it read every body, the MP sync: their runs are gone, so no link. */
const heldSync: LeadOf<
  "apply held politician sync" | "discard held politician sync" | "apply held MP sync" | "discard held MP sync"
> = (details) => ({
  parts: [copy.run(String(details.id))],
  fields: ["id"],
});

const account: LeadOf<"add staff account" | "remove staff account"> = (details) => ({
  parts: [details.email],
  fields: ["email"],
});

const address: LeadOf<"block address" | "unblock address" | "record opt-out"> = (details) => ({
  parts: [details.address],
  fields: ["address"],
});

/** About a politician, and the address added to or removed from theirs. */
const politicianAddress: LeadOf<"add politician address" | "remove politician address"> = (details, change) => ({
  parts: [
    <Who key="about" named={change.politician} href="/staff/politicians" name="" id={details.politicianId} />,
    details.address,
  ],
  fields: ["politicianId", "address"],
});

/** Each action's lead: whom or what it's about, linked where there's a page. */
const LEADS: { [A in AuditAction]: LeadOf<A> } = {
  "set status": status,
  "add politician": politician,
  "edit politician": politician,
  "remove politician": politician,
  "delete politician": politician,
  "add politician address": politicianAddress,
  "remove politician address": politicianAddress,
  "view supporter": (details, change) => ({
    parts: [<Who key="about" named={change.supporter} href="/staff/supporters" name="" id={details.id} />],
    fields: ["id"],
  }),
  "add note": note,
  "edit note": note,
  "delete note": note,
  "save filter": savedFilter,
  "update filter": savedFilter,
  "rename filter": savedFilter,
  "delete filter": savedFilter,
  "erase supporter": (details) => ({ parts: [copy.gone(String(details.id))], fields: ["id"] }),
  "apply held politician sync": heldSync,
  "discard held politician sync": heldSync,
  "apply held MP sync": heldSync,
  "discard held MP sync": heldSync,
  "apply held politician import": heldImport,
  "discard held politician import": heldImport,
  "add staff account": account,
  "set staff permissions": (details) => ({
    parts: [details.email, `${permissionNames(details.from)} → ${permissionNames(details.to)}`],
    fields: ["email", "from", "to"],
  }),
  "remove staff account": account,
  "block address": address,
  "unblock address": address,
  "record opt-out": address,
  "apply politician sync": none,
  "hold politician sync": none,
  "apply MP sync": none,
  "hold MP sync": none,
  "apply politician import": none,
  "hold politician import": none,
  "import ControlAI letter": none,
  "import web form letters": none,
  "import sign-ups": (details) => ({
    parts: [
      <StaffLink key="upload" href={signupUploadPath(details.uploadId)}>
        {staffCopy.signupUpload.uploads.title}
      </StaffLink>,
    ],
    fields: ["uploadId"],
  }),
  "import signatories from Airtable": none,
  "copy PauseAI emails": none,
  "remove supports status": none,
  "add ask": none,
  "edit ask": none,
  "delete ask": none,
  "end staff sessions": none,
  "connect gmail": none,
  "disconnect gmail": none,
  "set event owner": none,
  "set event doc": none,
  "create mailing": none,
  "schedule mailing": none,
  "reschedule mailing": none,
  "stop mailing": none,
  "delete mailing": none,
  "start mailing": none,
  "finish mailing": none,
  "create broadcast": none,
  "change broadcast consent": none,
  "submit broadcast template": none,
  "withdraw broadcast template": none,
  "schedule broadcast": none,
  "stop broadcast": none,
  "resume broadcast": none,
  "deal with reply": none,
  "answer reply": none,
  "download supporters": none,
  "download blocked emails": none,
  "download letters": none,
};

/**
 * An entry's lead, its details taken to be as its action logs them; none
 * for an action not known here, which the log may still hold.
 */
function leadOf(change: LoggedChange): Lead {
  return Object.hasOwn(LEADS, change.action) ? leadOfEvent(change as unknown as AuditEvent, change) : NO_LEAD;
}

/** The lead an entry's action gives, from its details: generic in the action, so each meets its own. */
function leadOfEvent<A extends AuditAction>(
  event: { action: A; details: StoredAuditDetails[A] },
  change: LoggedChange,
) {
  const lead: LeadOf<A> = LEADS[event.action];
  return lead(event.details, change);
}
