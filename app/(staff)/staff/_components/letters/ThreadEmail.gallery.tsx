// ThreadEmail in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import ThreadEmail from "./ThreadEmail";

/** Who a letter in the examples is from and to, when, and its subject. */
export const exampleEmail = {
  from: "Jane Smith <jane@example.com>",
  to: "Testy McTestface MP <testy.mctestface.mp@parliament.uk>",
  at: new Date("2026-10-12T09:05:00Z"),
  subject: "Please back a pause on frontier AI",
};

export const threadEmailGallery: Example[] = [
  {
    name: "ThreadEmail",
    file: "app/(staff)/staff/_components/letters/ThreadEmail.tsx",
    variants: [
      {
        label: "A message of a thread: who from and to, when, its subject with an action at its right, over its text",
        render: () => (
          <StaffPage as="div">
            <ThreadEmail {...exampleEmail} action={<a href="#">An action</a>}>
              Dear Mr McTestface, thank you.
            </ThreadEmail>
          </StaffPage>
        ),
      },
      {
        label: "One whose text isn't kept: no date, and a tinted body for the note in its place",
        render: () => (
          <StaffPage as="div">
            <ThreadEmail {...exampleEmail} at={null} missing>
              {"The letter's text isn't kept."}
            </ThreadEmail>
          </StaffPage>
        ),
      },
    ],
  },
];
