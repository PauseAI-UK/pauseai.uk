// SignupUploadResult in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { exampleSignupUpload, exampleSignupUploadPeople } from "./SignupUpload.examples";
import SignupUploadResult, { SignupUploadHead, SignupUploadsList } from "./SignupUploadResult";

export const signupUploadResultGallery: Example[] = [
  {
    name: "SignupUploadResult",
    file: "app/(staff)/staff/_components/supporters/SignupUploadResult.tsx",
    variants: [
      {
        label: "With what Luma said of each",
        render: () => <SignupUploadResult upload={exampleSignupUploadPeople} />,
      },
      {
        label: "Just imported, while the Luma import it started reads the event's guests",
        render: () => <SignupUploadResult upload={{ ...exampleSignupUploadPeople, lumaReading: true }} />,
      },
      {
        label: "Everyone since erased, with no event or note",
        render: () => (
          <SignupUploadResult
            upload={{ ...exampleSignupUpload, eventName: null, note: null, people: [], lumaReading: false }}
          />
        ),
      },
    ],
  },
  {
    name: "SignupUploadHead",
    file: "app/(staff)/staff/_components/supporters/SignupUploadResult.tsx",
    variants: [
      {
        label: "An upload's file, and under it what came of it, with its event and where it was collected",
        render: () => (
          <StaffPage as="div">
            <SignupUploadHead upload={exampleSignupUpload} />
          </StaffPage>
        ),
      },
      {
        label: "With no event or note",
        render: () => (
          <StaffPage as="div">
            <SignupUploadHead upload={{ ...exampleSignupUpload, eventName: null, note: null }} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "SignupUploadsList",
    file: "app/(staff)/staff/_components/supporters/SignupUploadResult.tsx",
    variants: [
      {
        label: "This year's and last year's, by the date on the forms",
        render: () => (
          <SignupUploadsList
            now="2026-11-07T12:00:00Z"
            uploads={[
              exampleSignupUpload,
              { ...exampleSignupUpload, id: 2, signedOn: "2025-06-14", note: null, eventName: null, heldBack: 0 },
            ]}
          />
        ),
      },
      { label: "None yet", render: () => <SignupUploadsList now="2026-11-07T12:00:00Z" uploads={[]} /> },
    ],
  },
];
