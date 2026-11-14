// The staff interface's mailings to politicians and our events: writing,
// scheduling and viewing a mailing, and the events list and its editing.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { eventColumnsGallery } from "@/app/(staff)/staff/_components/events/EventColumns.gallery";
import { eventEditGallery } from "@/app/(staff)/staff/_components/events/EventEdit.gallery";
import { eventFiltersGallery } from "@/app/(staff)/staff/_components/events/EventFilters.gallery";
import { eventsTableGallery } from "@/app/(staff)/staff/_components/events/EventsTable.gallery";
import type { Group } from "../_components/types";
import { mailingEditorGallery } from "@/app/(staff)/staff/_components/mailings/MailingEditor.gallery";
import { mailingFilesGallery } from "@/app/(staff)/staff/_components/mailings/MailingFiles.gallery";
import { mailingsOverviewGallery } from "@/app/(staff)/staff/_components/mailings/MailingsOverview.gallery";
import { mailingWriterGallery } from "@/app/(staff)/staff/_components/mailings/MailingWriter.gallery";
import { mailingViewGallery } from "@/app/(staff)/staff/_components/mailings/MailingView.gallery";
import { copyCountsGallery } from "@/app/(staff)/staff/_components/mailings/CopyCounts.gallery";
import { mailingForGallery } from "@/app/(staff)/staff/_components/mailings/MailingFor.gallery";
import { mailingLetterGallery } from "@/app/(staff)/staff/_components/mailings/MailingLetter.gallery";
import { mailingPartsGallery } from "@/app/(staff)/staff/_components/mailings/MailingParts.gallery";
import { dueTimeGallery } from "@/app/(staff)/staff/_components/mailings/DueTime.gallery";
import { mailingButtonsGallery } from "@/app/(staff)/staff/_components/mailings/MailingButtons.gallery";

// The events' examples, in the order the group shows them.
const [eventsTable, eventTabs, eventGroups, missing, eventsIntro] = eventsTableGallery;
const [eventsList, eventColumns] = eventColumnsGallery;

export const staffMailingsEvents: Group = {
  id: "staff-mailings-events",
  title: "The staff interface: mailings and events",
  examples: [
    ...mailingEditorGallery,
    ...mailingFilesGallery,
    eventsTable,
    eventTabs,
    eventGroups,
    eventsList,
    missing,
    eventColumns,
    ...eventFiltersGallery,
    ...eventEditGallery,
    eventsIntro,
    ...mailingsOverviewGallery,
    ...mailingWriterGallery,
    ...mailingViewGallery,
    ...copyCountsGallery,
    ...mailingForGallery,
    ...mailingLetterGallery,
    ...mailingPartsGallery,
    ...dueTimeGallery,
    ...mailingButtonsGallery,
  ],
};
