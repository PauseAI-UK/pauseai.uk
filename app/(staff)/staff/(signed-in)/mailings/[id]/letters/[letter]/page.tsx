import type { Metadata } from "next";
import { found } from "@/lib/found";
import { letterThread } from "@/lib/mailings/letter-thread.server";
import { listAsks } from "@/lib/asks/records.server";
import { getPauseaiLetter } from "@/lib/letters/records.server";
import { getPolitician } from "@/lib/politicians/records.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { letterId, mailingId } from "@/lib/staff-search";
import FindInGmail from "../../../../../_components/letters/FindInGmail";
import { letterTitle } from "../../../../../_components/letters/LetterHistory";
import LetterView from "../../../../../_components/letters/LetterView";
import LetterThread from "../../../../../_components/letters/LetterThread";
import { MailingLetter } from "../../../../../_components/mailings/MailingLetter";
import Page from "../../../../../_components/ui/Page";
import { setAskStatus } from "../../../../../_components/politicians/actions";
import AskRow, { AskRows } from "../../../../../_components/politicians/AskRow";
import { lettersCopy } from "../../../../../_components/letters/copy";

type Params = { params: Promise<{ id: string; letter: string }> };

/** The IDs in the URL, its mailing's and its letter's; or a 404. */
async function idsOf(params: Params["params"]): Promise<[number, number]> {
  const { id, letter } = await params;
  return [found(mailingId(id)), found(letterId(letter))];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff();
  return { title: letterTitle(found(await getPauseaiLetter(...(await idsOf(params))))) };
}

/**
 * One of a mailing's letters: how it stands, the letter as it went and
 * every reply in its thread, with Find it in Gmail,
 * beside the mailing's ask, to set the politician's answer, and its history.
 */
export default async function MailingLetterPage({ params }: Params) {
  await requireStaff();
  const ids = await idsOf(params);
  const [pauseaiLetter, thread, asks] = await Promise.all([getPauseaiLetter(...ids), letterThread(...ids), listAsks()]);
  const letter = found(pauseaiLetter);
  const politician = found(await getPolitician(letter.politicianId));
  return (
    <Page
      kind="item"
      under="mailings"
      via={[{ href: `/staff/mailings/${letter.mailingId}`, label: letter.mailing }]}
      here={lettersCopy.letters.crumb}
    >
      <LetterView
        letter={letter}
        politician={politician}
        asks={asks}
        answer={(ask) => (
          <AskRows>
            <AskRow politician={politician} ask={ask} setStatus={setAskStatus} />
          </AskRows>
        )}
      >
        <LetterThread
          thread={found(thread)}
          link={<FindInGmail find={letter.gmail} />}
          showLetter={(doc) => <MailingLetter doc={doc} />}
        />
      </LetterView>
    </Page>
  );
}
