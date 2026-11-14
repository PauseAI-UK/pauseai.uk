import type { Metadata } from "next";
import { found } from "@/lib/found";
import { now } from "@/lib/now";
import { broadcastsToSupporter } from "@/lib/server/broadcast-pages.server";
import { notesOn } from "@/lib/server/notes.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { getSupporter } from "@/lib/supporters/records.server";
import { supporterId } from "@/lib/staff-search";
import { canonicalSupporter, supporterTitle } from "@/lib/supporters/supporters";
import { optOutChoices } from "@/lib/supporters/opt-out-choices";
import { config } from "@/lib/server/config.server";
import { addNoteNow, deleteNoteNow, editNoteNow } from "../../../actions";
import { recordOptOutNow } from "../../../_components/supporters/actions";
import DevPreferences from "../../../_components/supporters/DevPreferences";
import OptOutForm from "../../../_components/supporters/OptOutForm";
import EraseLink from "../../../_components/erasure/EraseLink";
import Notes from "../../../_components/Notes";
import SupporterBroadcasts from "../../../_components/SupporterBroadcasts";
import SupporterDetails from "../../../_components/supporters/SupporterDetails";
import { supporterOneOffs } from "@/lib/letters/one-off-emails.server";
import { OneOffTable } from "../../../_components/letters/OneOffList";
import Page from "../../../_components/ui/Page";

type Params = { params: Promise<{ id: string }> };

/** The supporter with the ID in the URL; a redirect to their own page when it was merged into theirs; or a 404. */
async function supporterOf(params: Params["params"]) {
  const id = found(supporterId((await params).id));
  return canonicalSupporter(id, found(await getSupporter(id)));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff("supporters");
  const supporter = await supporterOf(params);
  return { title: supporterTitle(supporter.summary) };
}

/** One supporter: everything known of them, and what they did. */
export default async function SupporterPage({ params }: Params) {
  const staff = await requireStaff("supporters");
  const supporter = await supporterOf(params);
  const [notes, oneOffs, broadcasts] = await Promise.all([
    notesOn({ supporterId: supporter.summary.id }),
    supporterOneOffs(supporter.summary.id),
    broadcastsToSupporter(supporter.summary.id),
  ]);
  return (
    <Page kind="record" under="supporters" here={supporterTitle(supporter.summary)}>
      <SupporterDetails
        supporter={supporter}
        erase={<EraseLink supporterId={supporter.summary.id} />}
        oneOffs={<OneOffTable threads={oneOffs} />}
        messages={<SupporterBroadcasts broadcasts={broadcasts} />}
        sentAndNoted={{ broadcasts: broadcasts.length, notes: notes.length }}
        optOut={
          <>
            <OptOutForm
              supporterId={supporter.summary.id}
              choices={optOutChoices(supporter.permissions)}
              record={recordOptOutNow}
            />
            <DevPreferences
              emails={supporter.summary.emails}
              permissions={supporter.permissions}
              fixtures={config.fixtures}
            />
          </>
        }
        notes={
          <Notes
            notes={notes}
            supporterId={supporter.summary.id}
            reader={staff}
            at={now().toISOString()}
            add={addNoteNow}
            edit={editNoteNow}
            remove={deleteNoteNow}
          />
        }
      />
    </Page>
  );
}
