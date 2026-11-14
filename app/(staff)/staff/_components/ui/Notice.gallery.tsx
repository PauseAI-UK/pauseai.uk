// Notice in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { NoticeExample } from "./Notice.gallery.client";

export const noticeGallery: Example[] = [
  {
    name: "Notice",
    file: "app/(staff)/staff/_components/ui/Notice.tsx",
    variants: [{ label: "Open, lit as it opens; its × closes it", render: () => <NoticeExample /> }],
  },
];
