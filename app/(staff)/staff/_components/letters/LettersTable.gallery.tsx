// LettersTable in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import LettersTable from "./LettersTable";
import { exampleLetter } from "./LettersTable.examples";
import StaffPage from "../ui/StaffPage";

export const lettersTableGallery: Example[] = [
  {
    name: "LettersTable",
    file: "app/(staff)/staff/_components/letters/LettersTable.tsx",
    variants: [
      {
        label:
          "A bounced letter to a test MP, a replied one, one with only an automatic reply, and one not sent as the MP's address was blocked",
        render: () => (
          <StaffPage as="div">
            <LettersTable
              letters={[
                exampleLetter,
                {
                  ...exampleLetter,
                  id: 2,
                  status: "sent",
                  senderName: "Example Sender",
                  senderEmail: "sender@example.org",
                  mpName: "Polly Placeholder",
                  isTest: false,
                  repliedAt: new Date("2026-10-13T09:00:00Z"),
                  events: [
                    { at: new Date("2026-10-12T09:00:00Z"), status: "sending", details: {} },
                    { at: new Date("2026-10-12T09:05:00Z"), status: "sent", details: {} },
                  ],
                },
                {
                  ...exampleLetter,
                  id: 4,
                  status: "sent",
                  senderName: "Sam Jones",
                  senderEmail: "sam@example.org",
                  mpName: "Polly Placeholder",
                  isTest: false,
                  autoRepliedAt: new Date("2026-10-12T09:06:00Z"),
                  events: [
                    { at: new Date("2026-10-12T09:06:00Z"), status: "auto_reply", details: {} },
                    { at: new Date("2026-10-12T09:05:00Z"), status: "sent", details: {} },
                    { at: new Date("2026-10-12T09:00:00Z"), status: "sending", details: {} },
                  ],
                },
                {
                  ...exampleLetter,
                  id: 3,
                  status: "not_sent",
                  mpName: "Bouncy McTestface MP",
                  backend: null,
                  sentAt: null,
                  events: [
                    { at: new Date("2026-10-12T09:00:00Z"), status: "sending", details: {} },
                    { at: new Date("2026-10-12T09:00:00Z"), status: "not_sent", details: {} },
                  ],
                },
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "None",
        render: () => (
          <StaffPage as="div">
            <LettersTable letters={[]} />
          </StaffPage>
        ),
      },
    ],
  },
];
