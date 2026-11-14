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
import ChannelIcon from "@/components/ui/ChannelIcon";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import type { Group } from "../_components/types";
import { NotesExample, NoteChangesExample, NoteEntryExample, NotesCardExample, NoteTextExample } from "./staff.client";

const [optOutForm] = optOutFormGallery;

export const staffSupporters: Group = {
  id: "staff-supporters",
  title: "The staff interface: supporters",
  examples: [
    ...supporterFiltersGallery,
    ...supportersTableGallery,
    ...supporterBadgesGallery,
    ...subscriptionBadgesGallery,
    {
      name: "ChannelIcon",
      file: "components/ui/ChannelIcon.tsx",
      variants: [
        {
          label: "Email and phone, named, and as decoration",
          render: () => (
            <StaffPage as="div">
              <p>
                <ChannelIcon channel="email" label="Email" /> <ChannelIcon channel="phone" label="Phone" />{" "}
                <ChannelIcon channel="email" /> <ChannelIcon channel="phone" />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    ...supporterDetailsGallery,
    ...eraseFormGallery,
    ...erasedNoticeGallery,
    ...eraseLinkGallery,
    {
      name: "Notes",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [
        {
          label: "A supporter's notes card, as their writer sees them: her newest she can still change",
          render: () => (
            <StaffPage as="div">
              <NotesExample />
            </StaffPage>
          ),
        },
        {
          label: "As an admin, who can delete any",
          render: () => (
            <StaffPage as="div">
              <NotesExample as="admin" />
            </StaffPage>
          ),
        },
        {
          label: "None yet",
          render: () => (
            <StaffPage as="div">
              <NotesExample as="empty" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "NoteEntry",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [
        { label: "In a history: her own, which she can change", render: () => <NoteEntryExample /> },
        { label: "Someone else's, edited", render: () => <NoteEntryExample own={false} /> },
      ],
    },
    {
      name: "NoteChanges",
      file: "app/(staff)/staff/_components/NoteChanges.tsx",
      variants: [
        { label: "Its writer's: Edit, which opens Save, Cancel and Delete", render: () => <NoteChangesExample /> },
        { label: "An admin's, on someone else's: Delete alone", render: () => <NoteChangesExample editable={false} /> },
      ],
    },
    {
      name: "NotesCard",
      file: "app/(staff)/staff/_components/NotesCard.tsx",
      variants: [
        {
          label: "With Write a note, which drafts one at the top",
          render: () => (
            <StaffPage as="div">
              <NotesCardExample />
            </StaffPage>
          ),
        },
        {
          label: "No notes yet",
          render: () => (
            <StaffPage as="div">
              <NotesCardExample lines={false} />
            </StaffPage>
          ),
        },
        {
          label: "Without Write a note",
          render: () => (
            <StaffPage as="div">
              <NotesCardExample writable={false} />
            </StaffPage>
          ),
        },
      ],
    },
    optOutForm,
    ...devPreferencesGallery,
    {
      name: "NoteText",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [{ label: "With addresses, as links, on two lines", render: () => <NoteTextExample /> }],
    },
    ...signupUploadFormGallery,
    ...signupUploadHelpGallery,
    ...signupUploadPreviewGallery,
    ...signupUploadResultGallery,
  ],
};
