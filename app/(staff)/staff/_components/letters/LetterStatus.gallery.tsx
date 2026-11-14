// LetterStatus in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import LetterStatus from "./LetterStatus";
import StaffPage from "../ui/StaffPage";

export const letterStatusGallery: Example[] = [
  {
    name: "LetterStatus",
    file: "app/(staff)/staff/_components/letters/LetterStatus.tsx",
    variants: [
      {
        label:
          "Every status, every skip, one Gmail refused, one with only an automatic reply, one replied to, one answered, and one that bounced though answered",
        render: () => (
          <StaffPage as="div">
            <ul>
              {[
                "scheduled",
                "sending",
                "sent",
                "queued",
                "not_sent",
                "bounced",
                "spam_complaint",
                "uncertain",
                "cancelled",
              ].map((status) => (
                <li key={status}>
                  <LetterStatus status={status} answered={false} replied={false} />
                </li>
              ))}
              {(["blocked", "left-office", "no-email"] as const).map((reason) => (
                <li key={reason}>
                  <LetterStatus status="skipped" skipReason={reason} answered={false} replied={false} />
                </li>
              ))}
              <li>
                <LetterStatus status="not_sent" sentBy="gmail" answered={false} replied={false} />
              </li>
              <li>
                <LetterStatus status="sent" answered={false} replied={false} autoReplied />
              </li>
              <li>
                <LetterStatus status="sent" answered={false} replied />
              </li>
              <li>
                <LetterStatus status="sent" answered replied />
              </li>
              <li>
                <LetterStatus status="bounced" answered replied />
              </li>
            </ul>
          </StaffPage>
        ),
      },
    ],
  },
];
