// BounceReason in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import BounceReason from "./BounceReason";
import StaffPage from "../ui/StaffPage";

export const bounceReasonGallery: Example[] = [
  {
    name: "BounceReason",
    file: "app/(staff)/staff/_components/email/BounceReason.tsx",
    variants: [
      {
        label: "Postmark's, a long one found in someone's Gmail, folded to its first sentence, and a hold in CiviCRM",
        render: () => (
          <StaffPage as="div">
            <div>
              <BounceReason reason="Unknown user" kind="hard" foundInGmail={false} />
            </div>
            <div>
              <BounceReason
                reason="550-5.1.1 The email account that you tried to reach does not exist. Please try 550-5.1.1 double-checking the recipient's email address for typos. https://support.google.com/mail/?p=NoSuchUser - gsmtp"
                kind="hard"
                foundInGmail
              />
            </div>
            <div>
              <BounceReason reason="CiviCRM has the address on hold" kind="hold" foundInGmail={false} />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
