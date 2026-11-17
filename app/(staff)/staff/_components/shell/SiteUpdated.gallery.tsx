// SiteUpdated in the component gallery (app/(tools)/gallery/), in the staff interface's shell.
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { SiteUpdatedExample } from "./SiteUpdated.gallery.client";

export const siteUpdatedGallery: Example[] = [
  {
    name: "SiteUpdated",
    file: "app/(staff)/staff/_components/shell/SiteUpdated.tsx",
    variants: [
      {
        label: "Over a page whose button called the server after a deploy that renamed what it calls",
        render: () => <SiteUpdatedExample />,
      },
    ],
  },
];
