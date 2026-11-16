// SignupUploadPreview in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { LumaReading } from "./SignupUploadPreview";
import {
  SignupPlanViewExample,
  SignupUploadPreviewExample,
  WhatsappPlanViewExample,
} from "./SignupUploadPreview.gallery.client";

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
      {
        label: "A WhatsApp group: a new member, one with no profile name known by their number, one already uploaded, one forgotten",
        render: () => <WhatsappPlanViewExample />,
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
