"use client";

// LetterView's examples whose Server Action is a prop: each logged rather than sent.
import { examplePolitician } from "../politicians/PoliticianTable.examples";
import { examplePauseaiLetterDetails, exampleSupporterLetterDetails } from "./LettersTable.examples";
import { exampleThread } from "./LetterThread.examples";
import LetterView from "./LetterView";
import FindInGmail from "./FindInGmail";
import LetterThread, { SupporterLetterThread } from "./LetterThread";
import { MailingLetter } from "../mailings/MailingLetter";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { exampleAsks } from "../asks/AsksList.examples";
import AskRow, { AskRows } from "../politicians/AskRow";

/** One of a mailing's letters, with a reply, to the politician whose answer to its ask is set from it. */
export function MailingLetterViewExample() {
  const politician = { ...examplePolitician, airtableId: null };
  return (
    <Logged>
      {(log) => (
        <LetterView
          letter={{ ...examplePauseaiLetterDetails, mailingAsk: exampleAsks[0]!.slug }}
          politician={politician}
          asks={exampleAsks}
          answer={(ask) => (
            <AskRows>
              <AskRow politician={politician} ask={ask} setStatus={log("setStatus")} />
            </AskRows>
          )}
        >
          <LetterThread
            thread={exampleThread}
            showLetter={(doc) => <MailingLetter doc={doc} />}
            link={<a href="#">Open in Gmail</a>}
          />
        </LetterView>
      )}
    </Logged>
  );
}

/**
 * A supporter's letter to a test MP, which bounced, as an email with Find
 * it in Gmail, beside its campaign's ask, which `ask` says whether it makes.
 */
export function SupporterLetterViewExample({ ask }: { ask: boolean }) {
  const letter = { ...exampleSupporterLetterDetails, campaignAsk: ask ? exampleAsks[0]!.slug : null };
  const politician = { ...examplePolitician, airtableId: null, isTest: true, statuses: {} };
  return (
    <Logged>
      {(log) => (
        <LetterView
          letter={letter}
          politician={politician}
          asks={exampleAsks}
          answer={(one) => (
            <AskRows>
              <AskRow politician={politician} ask={one} setStatus={log("setStatus")} />
            </AskRows>
          )}
        >
          <SupporterLetterThread letter={letter} link={<FindInGmail find={letter.gmail} />} />
        </LetterView>
      )}
    </Logged>
  );
}
