// SignupUploadPreview in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { LumaReading } from "./SignupUploadPreview";
import { SignupPlanViewExample, SignupUploadPreviewExample } from "./SignupUploadPreview.gallery.client";

export const signupUploadPreviewGallery: Example[] = [
  {
    name: "SignupPlanView",
    file: "app/(staff)/staff/_components/supporters/SignupUploadPreview.tsx",
    variants: [
      {
        label:
          "Someone in every pile, one emailed how to lift “No bulk emails”, with the email they'll get, and one with “Do not email”",
        render: () => <SignupPlanViewExample />,
      },
    ],
  },
  {
    name: "LumaReading",
    file: "app/(staff)/staff/_components/supporters/SignupUploadPreview.tsx",
    variants: [{ label: "On an import's page, while Luma's read", render: () => <LumaReading /> }],
  },
  {
    name: "SignupUploadPreview",
    file: "app/(staff)/staff/_components/supporters/SignupUploadPreview.tsx",
    variants: [{ label: "Worked out, with someone in every pile", render: () => <SignupUploadPreviewExample /> }],
  },
];
