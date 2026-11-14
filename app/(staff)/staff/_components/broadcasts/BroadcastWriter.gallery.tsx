// BroadcastWriter in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { BroadcastWriterExample } from "./BroadcastWriter.gallery.client";

export const broadcastWriterGallery: Example[] = [
  {
    name: "BroadcastWriter",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastWriter.tsx",
    variants: [
      {
        label: "A draft email",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="email" />
          </StaffPage>
        ),
      },
      {
        label: "A draft text: the templates",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="choose" />
          </StaffPage>
        ),
      },
      {
        label: "A template chosen",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="template" />
          </StaffPage>
        ),
      },
      {
        label: "New words",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="new" />
          </StaffPage>
        ),
      },
      {
        label: "Rejected",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="rejected" />
          </StaffPage>
        ),
      },
      {
        label: "Before anything can be sent",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="off" />
          </StaffPage>
        ),
      },
    ],
  },
];
