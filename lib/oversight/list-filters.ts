// The audit log's and the sent emails' filter bars (lib/staff-list-filters.ts).
import { staffMemberText } from "@/lib/staff-member";
import { WINDOW_OPTIONS } from "@/lib/time-windows";
import { AUDIT_LOG_LIST, SENT_EMAILS_LIST } from "@/lib/staff-lists";
import { SENT_EMAIL_LINKS, SENT_EMAILS_WITHOUT_SUPPORTERS } from "@/lib/staff-search";
import { oversightCopy } from "./copy";
import { listFilters, choicesOf } from "@/lib/staff-list-filters";

/** The choices the audit log's filters offer: everyone in it, and everything they've done. */
export type ChangeChoices = { actors: string[]; actions: string[] };

/** The audit log's filters, in its columns' order: how recent; who and what, each of which can be chosen more than once. */
export const CHANGE_FILTERS = listFilters(AUDIT_LOG_LIST, ({ actors, actions }: ChangeChoices) => {
  const copy = oversightCopy.changes;
  return {
    when: { label: copy.at, options: WINDOW_OPTIONS },
    actor: {
      label: copy.actor,
      oneEach: true,
      options: actors.map((value) => ({ value, label: staffMemberText(value) })),
    },
    action: { label: copy.action, oneEach: true, options: actions.map((value) => ({ value, label: value })) },
  };
});

/** The send log's filters, their kinds of email only those a staff member without `supporters` may see. */
export const SENT_EMAIL_FILTERS = listFilters(SENT_EMAILS_LIST, ({ supporters }: { supporters: boolean }) => {
  const copy = oversightCopy.sentEmails;
  return {
    purpose: {
      label: copy.filters.purpose,
      oneEach: true,
      options: choicesOf(copy.purposes).filter(
        ({ value }) => supporters || SENT_EMAILS_WITHOUT_SUPPORTERS.includes(value),
      ),
    },
    backend: { label: copy.filters.backend, oneEach: true, options: choicesOf(copy.backends) },
    outcome: { label: copy.filters.outcome, oneEach: true, options: choicesOf(copy.outcomes) },
    link: {
      label: copy.columns.links,
      options: SENT_EMAIL_LINKS.map((value) => ({ value, label: copy.filters.links[value] })),
    },
  };
});
