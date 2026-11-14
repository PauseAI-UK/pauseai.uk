import type { Metadata } from "next";
import { found } from "@/lib/found";
import { listAsks } from "@/lib/campaigns/records";
import { blockOn } from "@/lib/server/email";
import { pauseaiLetters, politicianLetters } from "@/lib/server/letters";
import { notesOn } from "@/lib/server/notes";
import { getPolitician, politicianHistory } from "@/lib/politicians/records";
import { requireStaff } from "@/lib/accounts/auth";
import { now } from "@/lib/now";
import { politicianId } from "@/lib/staff-search";
import { politicianAliases } from "@/lib/politicians/aliases";
import { addNoteNow, deleteNoteNow, editNoteNow, unblockAddress } from "../../../actions";
import {
  addAliasNow,
  editPoliticianNow,
  removeAliasNow,
  setAskStatus,
  setMarkNow,
} from "../../../_components/politicians/actions";
import { politicianOneOffs } from "@/lib/server/one-off-emails";
import { politicianMessages } from "@/lib/politicians/correspondence";
import PoliticianDetails from "../../../_components/politicians/PoliticianDetails";
import Page from "../../../_components/ui/Page";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff();
  const politician = found(await getPolitician(found(politicianId((await params).id))));
  return { title: politician.name };
}

export default async function PoliticianPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ correspondence?: string | string[]; aliases?: string | string[] }> }) {
  const staff = await requireStaff();
  const { permissions } = staff;
  const politician = found(await getPolitician(found(politicianId((await params).id))));
  const query = await searchParams;
  const [asks, block, letters, fromPauseai, history, notes, oneOffs, messages, aliases] = await Promise.all([
    listAsks(),
    blockOn(politician.email),
    politicianLetters(politician.id, permissions),
    pauseaiLetters(politician.id),
    politicianHistory(politician.id, politician.email),
    notesOn({ politicianId: politician.id }),
    politicianOneOffs(politician.id, permissions),
    politicianMessages(politician.id, permissions),
    politicianAliases(politician),
  ]);
  return (
    <Page kind="record" under="politicians" here={politician.name}>
      <PoliticianDetails
        politician={politician}
        asks={asks}
        setStatus={setAskStatus}
        block={block}
        unblock={unblockAddress}
        letters={letters}
        pauseaiLetters={fromPauseai}
        oneOffs={oneOffs}
        messages={messages}
        onlyReplies={query.correspondence === "replies"}
        aliases={aliases}
        aliasesOpen={query.aliases === "open"}
        aliasActions={{ add: addAliasNow, remove: removeAliasNow }}
        history={history}
        setMark={setMarkNow}
        editDetails={editPoliticianNow}
        notes={{
          notes,
          reader: staff,
          at: now().toISOString(),
          add: addNoteNow,
          edit: editNoteNow,
          remove: deleteNoteNow,
        }}
      />
    </Page>
  );
}
