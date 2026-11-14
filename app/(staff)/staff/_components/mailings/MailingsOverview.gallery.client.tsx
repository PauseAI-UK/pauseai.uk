"use client";

// MailingsOverview's examples, the list of mailings in its groups (MailingsOverview.gallery.tsx).
import MailingsOverview from "./MailingsOverview";
import { mailingGroups } from "@/lib/mailings/groups";
import { exampleDraft, exampleMailings, exampleScheduled, exampleSending } from "./MailingsTable.examples";

/** The list of mailings, in its groups as of 30 October 2026: one sending, one scheduled, two drafts, and those sent; or none. */
export function MailingsOverviewExample({ empty = false }: { empty?: boolean }) {
  const now = "2026-10-30T12:00:00Z";
  const groups = empty
    ? []
    : mailingGroups(
        {
          drafts: [exampleDraft, { ...exampleDraft, id: 7, title: "" }],
          comingUp: [exampleScheduled, exampleSending],
          sent: [...exampleMailings, { ...exampleMailings[1], id: 9, sentAt: new Date("2025-07-09T10:00:00Z") }],
        },
        new Date(now),
      );
  return <MailingsOverview groups={groups} now={now} />;
}
