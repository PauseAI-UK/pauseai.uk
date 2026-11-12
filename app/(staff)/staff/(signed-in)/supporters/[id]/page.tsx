import type { Metadata } from "next";
import { found } from "@/lib/found";
import { now } from "@/lib/now";
import { broadcastsToSupporter } from "@/lib/server/broadcast-pages";
import { notesOn } from "@/lib/server/notes";
import { requireStaff } from "@/lib/server/staff-auth";
import { getSupporter } from "@/lib/server/supporters";
import { supporterId } from "@/lib/staff-search";
import { canonicalSupporter, supporterTitle } from "@/lib/supporters";
import { optOutChoices } from "@/lib/opt-out-choices";
import { config } from "@/lib/server/config";
import { addNoteNow, deleteNoteNow, editNoteNow, recordOptOutNow } from "../../../actions";
import DevPreferences from "../../../_components/DevPreferences";
import OptOutForm from "../../../_components/OptOutForm";
import EraseLink from "../../../_components/EraseLink";
import Notes from "../../../_components/Notes";
import SupporterBroadcasts from "../../../_components/SupporterBroadcasts";
import SupporterDetails from "../../../_components/SupporterDetails";
import { supporterOneOffs } from "@/lib/server/one-off-emails";
import { OneOffTable } from "../../../_components/OneOffList";
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
        optOut={
          <>
            <OptOutForm
              supporterId={supporter.summary.id}
              choices={optOutChoices(supporter.permissions)}
              record={recordOptOutNow}
            />
            <DevPreferences emails={supporter.summary.emails} fixtures={config.fixtures} />
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
