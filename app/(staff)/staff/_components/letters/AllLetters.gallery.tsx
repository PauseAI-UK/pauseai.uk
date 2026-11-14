// AllLetters in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import AllLetters from "./AllLetters";
import StaffPage from "../ui/StaffPage";

export const allLettersGallery: Example[] = [
  {
    name: "AllLetters",
    file: "app/(staff)/staff/_components/letters/AllLetters.tsx",
    variants: [
      {
        label:
          "A supporter's letter with a reply, one of PauseAI's not sent and a one-off thread, filtered to the last 30 days",
        render: () => (
          <StaffPage as="div">
            <AllLetters
              found={{
                letters: [
                  {
                    id: 1,
                    kind: "supporter",
                    status: "sent",
                    sentAt: new Date("2026-10-20T10:00:00Z"),
                    repliedAt: new Date("2026-10-21T10:00:00Z"),
                    replies: 1,
                    people: [{ id: 1, name: "Polly Placeholder" }],
                    senderName: "Jane Smith",
                    senderEmail: "jane.smith@example.com",
                    supporterId: 1,
                    campaign: "regulate-letter-pm",
                    campaignTitle: "Regulate AI",
                  },
                  {
                    id: 2,
                    kind: "pauseai",
                    status: "scheduled",
                    sentAt: null,
                    repliedAt: null,
                    replies: 0,
                    people: [{ id: 1, name: "Polly Placeholder" }],
                    mailingId: 3,
                    mailingTitle: "A letter about the march",
                  },
                  {
                    id: 3,
                    kind: "one-off",
                    status: "one-off",
                    sentAt: new Date("2026-10-19T10:00:00Z"),
                    repliedAt: null,
                    replies: 0,
                    people: [{ id: 1, name: "Polly Placeholder" }],
                    senderName: "Sam Jones",
                    senderEmail: "sam@example.com",
                    fromUs: false,
                    recipients: [{ name: "", politicianId: null, pauseai: true }],
                    subject: "Coffee next week?",
                  },
                ],
                total: 3,
                pages: 1,
              }}
              search={{
                q: "",
                from: [],
                type: [],
                to: [],
                sent: "30",
                replied: "",
                flag: [],
                sort: "",
                dir: "",
                page: "",
              }}
              people={[{ id: 1, name: "Polly Placeholder", constituency: "Cities of London and Westminster" }]}
              supporters
              inbox="policy@example.org"
            />
          </StaffPage>
        ),
      },
    ],
  },
];
