// ErrorSeenView in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ErrorSeenViewExample } from "./ErrorSeenView.gallery.client";

export const errorSeenViewGallery: Example[] = [
  {
    name: "ErrorSeenView",
    file: "app/(staff)/staff/_components/oversight/ErrorSeenView.tsx",
    variants: [
      {
        label: "A Postgres error in a page, with its stack trace",
        render: () => (
          <StaffPage as="div">
            <ErrorSeenViewExample which={0} />
          </StaffPage>
        ),
      },
      {
        label: "A problem, which has no stack trace",
        render: () => (
          <StaffPage as="div">
            <ErrorSeenViewExample which={1} />
          </StaffPage>
        ),
      },
      {
        label: "A page that fell over in a browser",
        render: () => (
          <StaffPage as="div">
            <ErrorSeenViewExample which={2} />
          </StaffPage>
        ),
      },
      {
        label: "Marked done",
        render: () => (
          <StaffPage as="div">
            <ErrorSeenViewExample which="done" />
          </StaffPage>
        ),
      },
    ],
  },
];
