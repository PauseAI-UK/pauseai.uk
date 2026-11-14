"use client";

// PoliticianCorrespondence's example, its threads worked out in the browser (PoliticianCorrespondence.gallery.tsx).
import { exampleLetter } from "@/app/(staff)/staff/_components/LettersTable.examples";
import { correspondenceThreads } from "@/lib/politicians/threads";
import PoliticianCorrespondence from "./PoliticianCorrespondence";

/** Threads of each kind: answered, unanswered, an automatic reply, own words, and past the fold. */
const exampleThreads = (count = 3) =>
  correspondenceThreads({
    letters: {
      senders: true,
      letters: Array.from({ length: count }, (_, i) => ({
        ...exampleLetter,
        id: 100 + i,
        ownWords: i === 0 ? 0.14 : 0,
        repliedAt: null,
      })),
    },
    pauseaiLetters: [
      {
        id: 200,
        mailingId: 3,
        mailing: "Example Mailing",
        status: "sent",
        at: exampleLetter.createdAt,
        personalised: false,
      },
    ],
    oneOffs: [],
    messages: {
      subjects: {},
      letters: {
        100: [{ at: exampleLetter.createdAt, who: "them", name: "Polly Placeholder", auto: false }],
        101: [{ at: exampleLetter.createdAt, who: "them", name: null, auto: true }],
      },
      oneOffs: {},
    },
  });

export function PoliticianCorrespondenceExample({ count }: { count?: number }) {
  return <PoliticianCorrespondence threads={exampleThreads(count)} />;
}
