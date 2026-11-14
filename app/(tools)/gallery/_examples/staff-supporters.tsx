// The staff interface's supporter pages: the list and its filters, a
// supporter's details, notes and erasure, on fake supporters.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { eraseFormGallery } from "@/app/(staff)/staff/_components/erasure/EraseForm.gallery";
import { eraseLinkGallery } from "@/app/(staff)/staff/_components/erasure/EraseLink.gallery";
import { erasedNoticeGallery } from "@/app/(staff)/staff/_components/erasure/ErasedNotice.gallery";
import { devPreferencesGallery } from "@/app/(staff)/staff/_components/supporters/DevPreferences.gallery";
import { optOutFormGallery } from "@/app/(staff)/staff/_components/supporters/OptOutForm.gallery";
import { signupUploadFormGallery } from "@/app/(staff)/staff/_components/supporters/SignupUploadForm.gallery";
import { signupUploadHelpGallery } from "@/app/(staff)/staff/_components/supporters/SignupUploadHelp.gallery";
import { signupUploadPreviewGallery } from "@/app/(staff)/staff/_components/supporters/SignupUploadPreview.gallery";
import { signupUploadResultGallery } from "@/app/(staff)/staff/_components/supporters/SignupUploadResult.gallery";
import { subscriptionBadgesGallery } from "@/app/(staff)/staff/_components/supporters/SubscriptionBadges.gallery";
import { supporterBadgesGallery } from "@/app/(staff)/staff/_components/supporters/SupporterBadges.gallery";
import { supporterDetailsGallery } from "@/app/(staff)/staff/_components/supporters/SupporterDetails.gallery";
import { supporterFiltersGallery } from "@/app/(staff)/staff/_components/supporters/SupporterFilters.gallery";
import { supportersTableGallery } from "@/app/(staff)/staff/_components/supporters/SupportersTable.gallery";
import type { Group } from "../_components/types";
import { channelIconGallery } from "@/components/ui/ChannelIcon.gallery";
import { notesCardGallery } from "@/app/(staff)/staff/_components/notes/NotesCard.gallery";
import { noteChangesGallery } from "@/app/(staff)/staff/_components/notes/NoteChanges.gallery";
import { notesGallery } from "@/app/(staff)/staff/_components/notes/Notes.gallery";

const [optOutForm] = optOutFormGallery;

const [notes, noteEntry, noteText] = notesGallery;

export const staffSupporters: Group = {
  id: "staff-supporters",
  title: "The staff interface: supporters",
  examples: [
    ...supporterFiltersGallery,
    ...supportersTableGallery,
    ...supporterBadgesGallery,
    ...subscriptionBadgesGallery,
    ...channelIconGallery,
    ...supporterDetailsGallery,
    ...eraseFormGallery,
    ...erasedNoticeGallery,
    ...eraseLinkGallery,
    notes,
    noteEntry,
    ...noteChangesGallery,
    ...notesCardGallery,
    optOutForm,
    ...devPreferencesGallery,
    noteText,
    ...signupUploadFormGallery,
    ...signupUploadHelpGallery,
    ...signupUploadPreviewGallery,
    ...signupUploadResultGallery,
  ],
};
