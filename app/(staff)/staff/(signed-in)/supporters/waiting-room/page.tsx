import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth.server";
import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import { waitingStateOf } from "@/lib/broadcasts/waiting-room";
import { communityLink, waitingRoom } from "@/lib/broadcasts/waiting-room.server";
import { dismissNow, letInNow, setLinkNow } from "../../../_components/broadcasts/waiting-room-actions";
import WaitingRoom from "../../../_components/broadcasts/WaitingRoom";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { shellCopy } from "../../../_components/shell/copy";

export const metadata: Metadata = { title: shellCopy.nav.waitingRoom };

/** The WhatsApp waiting room: its link, and who's in it, a tab for each state (`show`), held by default. */
export default async function WaitingRoomPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff("supporters");
  const state = waitingStateOf((await searchParams).show);
  const [{ people, counts }, link] = await Promise.all([waitingRoom(state), communityLink()]);
  return (
    <Page kind="list">
      <PageHead intro={waitingRoomCopy.page.intro}>{shellCopy.nav.waitingRoom}</PageHead>
      <WaitingRoom
        state={state}
        people={people}
        counts={counts}
        link={link}
        actions={{ letIn: letInNow, dismiss: dismissNow, setLink: setLinkNow }}
      />
    </Page>
  );
}
