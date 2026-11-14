// MailingView in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx) and the staff broadcasts group
// (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingWhen } from "./MailingView";
import { exampleBroadcastSent, exampleBroadcastSummary } from "../BroadcastWriter.examples";
import { MailingStandingExample, MailingViewExample } from "./MailingView.gallery.client";

export const mailingViewGallery: Example[] = [
  {
    name: "MailingView",
    file: "app/(staff)/staff/_components/mailings/MailingView.tsx",
    variants: [
      {
        label: "One imported from Airtable: who got it and how it was written, no text",
        render: () => (
          <StaffPage as="div">
            <MailingViewExample state="imported" />
          </StaffPage>
        ),
      },
      {
        label: "Scheduled, with Change the time and Stop",
        render: () => (
          <StaffPage as="div">
            <MailingViewExample state="scheduled" />
          </StaffPage>
        ),
      },
      {
        label: "Sending, with how far it's got",
        render: () => (
          <StaffPage as="div">
            <MailingViewExample state="sending" />
          </StaffPage>
        ),
      },
      {
        label: "Sent, with its counts and recipients",
        render: () => (
          <StaffPage as="div">
            <MailingViewExample state="sent" />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "MailingStanding",
    file: "app/(staff)/staff/_components/mailings/MailingView.tsx",
    variants: [
      {
        label: "Sending, with Stop sending",
        render: () => (
          <StaffPage as="div">
            <MailingStandingExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "MailingWhen",
    file: "app/(staff)/staff/_components/mailings/MailingView.tsx",
    variants: [
      {
        label: "When it went",
        render: () => (
          <dl>
            <MailingWhen mailing={exampleBroadcastSummary} written={exampleBroadcastSent.written} />
          </dl>
        ),
      },
    ],
  },
];
