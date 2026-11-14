// CopyStatus in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { CopyStatus } from "./CopyStatus";

export const copyStatusGallery: Example[] = [
  {
    name: "CopyStatus",
    file: "app/(staff)/staff/_components/mailings/CopyStatus.tsx",
    variants: [
      {
        label:
          "Each state, a colour each: sent, delivered, read, replied and answered; a reply to check; opted out because of it; marked as spam; an error; didn't reach; and not sent",
        render: () => (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <CopyStatus copyOf={{ state: "sent", why: null }} />
            <CopyStatus copyOf={{ state: "delivered", why: null }} />
            <CopyStatus copyOf={{ state: "read", why: null }} />
            <CopyStatus copyOf={{ state: "replied", why: null }} />
            <CopyStatus copyOf={{ state: "answered", why: null }} />
            <CopyStatus copyOf={{ state: "spam", why: null }} />
            <CopyStatus copyOf={{ state: "look", why: null }} />
            <CopyStatus copyOf={{ state: "opted-out", why: "whatsapp-reply" }} />
            <CopyStatus copyOf={{ state: "error", why: "whatsapp" }} />
            <CopyStatus copyOf={{ state: "unreached", why: "bounced" }} />
            <CopyStatus copyOf={{ state: "not-sent", why: "suppressed" }} />
          </div>
        ),
      },
    ],
  },
];
