import { expect, it } from "vitest";
import { ASK_STATUSES, ASKERS } from "@/lib/asks";
import { TOPICS, WAYS } from "@/lib/contact-permissions";
import { ERROR_KINDS } from "@/lib/error-key";
import { IMPORT_JOBS, type ImportRunStatus } from "@/lib/import-runs";
import { RECORDED_LETTER_EVENTS } from "@/lib/letter-status";
import { COUNTRIES } from "@/lib/politician-filters";
import { query } from "@/lib/server/db";
import type { Backend, ProblemKind, Purpose } from "@/lib/server/email";
import type { EntryLuma } from "@/lib/server/form-entries";
import { GUEST_STATUSES, type ImportList } from "@/lib/server/luma-import";
import type { mailingChannel } from "@/lib/server/mailing-channels";
import type { MailingState } from "@/lib/server/mailing-drafts";
import type { SkipReason } from "@/lib/server/mailings";
import type { WhatsAppTemplate } from "@/lib/server/broadcast-drafts";
import type { OptOutSource } from "@/lib/server/opt-outs";
import type { AddressSource } from "@/lib/server/politician-aliases";
import { INTENTS, LIST_STATUSES } from "@/lib/server/outside-services/civicrm";
import type { CalendarEvent } from "@/lib/server/outside-services/luma-calendar";
import { HOUSES, PERSON_STATUSES } from "@/lib/server/politicians";
import type { SignupUploadPerson } from "@/lib/server/signup-uploads";
import { PERMISSIONS } from "@/lib/staff-permissions";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";

// A column whose CHECK lists the values it allows lists them in TypeScript
// too, so a value added to one and not the other fails here rather than when
// a row is written. A CHECK that does more than list one column's values
// (letters_status_check, say) isn't compared.

/**
 * Every value of the union T, as a list, which the type checker holds to T:
 * a value T hasn't got, or one of T's left out, fails `npm run typecheck`.
 * For the columns whose values TypeScript has as a type but no constant.
 */
function every<T extends string>() {
  return <const L extends readonly T[]>(
    list: L & ([Exclude<T, L[number]>] extends [never] ? unknown : { missing: Exclude<T, L[number]> }),
  ) => list;
}

/** Each `table.column` and the TypeScript that lists its values. */
const LISTED: Record<string, readonly string[]> = {
  "ask_kind_statuses.kind": Object.keys(ASK_STATUSES),
  "asks.asked_by": ASKERS,
  "asks.kind": Object.keys(ASK_STATUSES),
  "email_problems.kind": every<ProblemKind>()(["hard", "soft", "complaint", "hold"]),
  "civicrm_contacts.intent": INTENTS,
  "civicrm_contacts.newsletter": LIST_STATUSES,
  "civicrm_contacts.volunteer_updates": LIST_STATUSES,
  "email_sends.backend": every<Backend["name"]>()(["postmark", "gmail"]),
  "email_sends.purpose": every<Purpose>()([
    "letter",
    "letter-copy",
    "relay",
    "supporter-notice",
    "office-notice",
    "forwarded-reply",
    "staff-login",
    "staff-alert",
    "staff-report",
    "mailing",
    "mailing-test",
  ]),
  "errors_seen.kind": ERROR_KINDS,
  "form_entry_luma.status": every<EntryLuma["status"]>()(["added", "skipped", "not-configured", "failed"]),
  "import_runs.job": IMPORT_JOBS,
  "import_runs.status": every<ImportRunStatus>()(["ok", "failed", "unchanged", "held", "applied", "discarded"]),
  "letter_events.status": RECORDED_LETTER_EVENTS,
  "letters_from_pauseai.skip_reason": every<SkipReason>()(["blocked", "left-office", "no-email"]),
  "luma_events.access": every<CalendarEvent["access"]>()(["manage", "view"]),
  "luma_guests.approval_status": GUEST_STATUSES,
  "luma_import_state.list": every<ImportList>()(["events", "contacts"]),
  "mailings.channel": every<Parameters<typeof mailingChannel>[0]>()(["email", "text", "whatsapp"]),
  "mailings.state": every<MailingState>()(["draft", "scheduled", "sending", "sent", "cancelled"]),
  "mailings.topic": TOPICS,
  "whatsapp_templates.status": every<WhatsAppTemplate["status"]>()(["approved", "pending", "rejected"]),
  "notable_people.status": PERSON_STATUSES,
  "opt_outs.way": WAYS,
  "opt_outs.list": TOPICS,
  "opt_outs.source": every<OptOutSource>()(["luma-webhook", "luma-contacts", "civicrm"]),
  "politician_addresses.source": every<AddressSource>()(["parliament", "office", "staff", "rejected"]),
  "politicians.country": COUNTRIES,
  "politicians.house": HOUSES,
  "signup_upload_entries.known": every<NonNullable<SignupUploadPerson["known"]>>()(["email", "mobile"]),
  "signup_upload_entries.luma": every<NonNullable<SignupUploadPerson["luma"]>>()([
    "going",
    "added",
    "skipped",
    "failed",
    "not-configured",
  ]),
  "staff_accounts.permissions": PERMISSIONS,
};

/** The columns whose values TypeScript lists nowhere it can be read from, written only as SQL or as a function's own literals. */
const UNLISTED = [
  "broadcast_message_events.kind",
  "broadcast_messages.skip_reason",
  "broadcast_messages.status",
  "email_sends.outcome",
  "form_entries.form",
  "letter_relays.status",
  "letters.kind",
  "letters_from_supporters.copy_state",
  "mailings.audience",
  "old_letters_mail.outcome",
  "old_letters_mail.source",
];

/** The values a CHECK lists for its column: `col = ANY (ARRAY[…])`, as Postgres writes `col IN (…)`, or `col <@ ARRAY[…]` for an array. */
const LIST_CHECK = /^CHECK \(\((\w+) (?:= ANY \(|<@ )ARRAY\[([^\]]*)\]\)+$/;

describeWithDatabase("the CHECKs that list a column's values", () => {
  useTestDatabase();

  it("list the values TypeScript does", async () => {
    const checks = await query<{ table: string; definition: string }>(
      `SELECT conrelid::regclass::text AS table, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE contype = 'c' AND conrelid <> 0`,
    );
    const inDatabase: Record<string, string[]> = {};
    for (const { table, definition } of checks) {
      const list = definition.match(LIST_CHECK);
      if (!list) continue;
      inDatabase[`${table}.${list[1]}`] = [...list[2].matchAll(/'((?:[^']|'')*)'::text/g)]
        .map(([, value]) => value.replace(/''/g, "'"))
        .sort();
    }
    const unlisted = Object.keys(inDatabase).filter((column) => UNLISTED.includes(column));
    expect(unlisted.sort()).toEqual(UNLISTED);
    for (const column of unlisted) delete inDatabase[column];
    const inTypeScript = Object.fromEntries(
      Object.entries(LISTED).map(([column, values]) => [column, [...values].sort()]),
    );
    expect(inDatabase).toEqual(inTypeScript);
  });
});
