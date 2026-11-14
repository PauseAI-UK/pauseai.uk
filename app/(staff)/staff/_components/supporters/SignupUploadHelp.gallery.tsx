// SignupUploadHelp in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { SignupColumnNames } from "./SignupUploadHelp";
import { SignupUploadHelpExample } from "./SignupUploadHelp.gallery.client";

export const signupUploadHelpGallery: Example[] = [
  {
    name: "SignupUploadHelp",
    file: "app/(staff)/staff/_components/supporters/SignupUploadHelp.tsx",
    variants: [
      {
        label: "What the file needs, and the button that opens every name",
        render: () => <SignupUploadHelpExample />,
      },
    ],
  },
  {
    name: "SignupColumnNames",
    file: "app/(staff)/staff/_components/supporters/SignupUploadHelp.tsx",
    variants: [{ label: "Every column name, and its values", render: () => <SignupColumnNames /> }],
  },
];
