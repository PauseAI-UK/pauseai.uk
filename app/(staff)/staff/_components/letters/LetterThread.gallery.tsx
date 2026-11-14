// LetterThread in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import type { LetterDoc } from "@/lib/letters/format";
import { exampleEmail } from "./ThreadEmail.gallery";
import {
  exampleAutoRepliedLetterDetails,
  exampleProxiedLetterDetails,
  exampleSupporterLetterDetails,
} from "./LettersTable.examples";
import StaffPage from "../ui/StaffPage";
import ThreadEmail from "./ThreadEmail";
import LetterThread, { MessageText, SupporterLetterThread, Thread } from "./LetterThread";
import { MailingLetter } from "../mailings/MailingLetter";
import { exampleImportedThread, exampleThread } from "./LetterThread.examples";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

/** A mailing's letter as it reads, as its page shows it. */
const showLetter = (doc: LetterDoc) => <MailingLetter doc={doc} />;

export const letterThreadGallery: Example[] = [
  {
    name: "LetterThread",
    file: "app/(staff)/staff/_components/letters/LetterThread.tsx",
    variants: [
      {
        label: "Sent from Jo's Gmail: Polly's answer, and Jo's that can't be read",
        render: () => (
          <StaffPage as="div">
            <LetterThread thread={exampleThread} showLetter={showLetter} />
          </StaffPage>
        ),
      },
      {
        label: "Imported from Airtable, never sent: no text, no replies",
        render: () => (
          <StaffPage as="div">
            <LetterThread thread={exampleImportedThread} showLetter={showLetter} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "SupporterLetterThread",
    file: "app/(staff)/staff/_components/letters/LetterThread.tsx",
    variants: [
      {
        label:
          "A supporter's letter, from them, leading to their supporter page: no text, which is in the policy inbox",
        render: () => (
          <StaffPage as="div">
            <SupporterLetterThread letter={exampleSupporterLetterDetails} />
          </StaffPage>
        ),
      },
      {
        label:
          "A letter from the letters inbox: its changes to the draft, then the office's reply and the supporter's answer",
        render: () => (
          <StaffPage as="div">
            <SupporterLetterThread letter={exampleProxiedLetterDetails} />
          </StaffPage>
        ),
      },
      {
        label:
          "Only automatic replies: the office's folded to its first paragraph, the supporter's one paragraph whole",
        render: () => (
          <StaffPage as="div">
            <SupporterLetterThread letter={exampleAutoRepliedLetterDetails} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "MessageText",
    file: "app/(staff)/staff/_components/letters/LetterThread.tsx",
    variants: [
      {
        label: "A reply, the mail it quotes folded under it",
        render: () => (
          <StaffPage as="div">
            <MessageText
              text={"Dear Jo,\n\nYes, I'd be glad to meet."}
              quoted={"On 5 Jun 2026, Jo wrote:\n> Will you?"}
            />
          </StaffPage>
        ),
      },
      {
        label: "An automatic reply of four paragraphs, folded to its first",
        render: () => {
          const reply = exampleAutoRepliedLetterDetails.messages[0];
          return (
            <StaffPage as="div">
              <MessageText text={reply.text!} quoted="" auto />
            </StaffPage>
          );
        },
      },
    ],
  },
  {
    name: "Thread",
    file: "app/(staff)/staff/_components/letters/LetterThread.tsx",
    variants: [
      {
        label: "A thread's section: its heading, a link at its right, over its messages",
        render: () => (
          <StaffPage as="div">
            <Thread link={<a href="#">Open in Gmail</a>}>
              <ThreadEmail {...exampleEmail}>Dear Mr McTestface, thank you.</ThreadEmail>
            </Thread>
          </StaffPage>
        ),
      },
      {
        label: "Titled as a broadcast's message is",
        render: () => (
          <StaffPage as="div">
            <Thread title={broadcastsCopy.broadcastPages.threadTitle}>
              <ThreadEmail {...exampleEmail}>Hi Jane, the march meets at 11:00.</ThreadEmail>
            </Thread>
          </StaffPage>
        ),
      },
    ],
  },
];
