// AddAliasForm in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { AddAliasFormExample } from "./AddAliasForm.gallery.client";

export const addAliasFormGallery: Example[] = [
  {
    name: "AddAliasForm",
    file: "app/(staff)/staff/_components/politicians/AddAliasForm.tsx",
    variants: [
      {
        label: "Added: its earlier emails are found soon",
        render: () => <AddAliasFormExample result={{ added: true }} />,
      },
      {
        label: "Not an email address",
        render: () => <AddAliasFormExample result={{ added: false, why: "invalid" }} />,
      },
      {
        label: "An address they have already",
        render: () => <AddAliasFormExample result={{ added: false, why: "exists" }} />,
      },
      {
        label: "The Lords' shared inbox",
        render: () => <AddAliasFormExample result={{ added: false, why: "shared" }} />,
      },
    ],
  },
];
