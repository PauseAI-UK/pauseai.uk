// SignupUploadForm in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { SignupUploadFormExample } from "./SignupUploadForm.gallery.client";

export const signupUploadFormGallery: Example[] = [
  {
    name: "SignupUploadForm",
    file: "app/(staff)/staff/_components/supporters/SignupUploadForm.tsx",
    variants: [{ label: "Before a file: its four steps", render: () => <SignupUploadFormExample /> }],
  },
];
