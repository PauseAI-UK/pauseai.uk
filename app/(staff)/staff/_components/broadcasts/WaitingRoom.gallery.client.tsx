"use client";

// The WhatsApp waiting room's page, its buttons logged (WaitingRoom.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { WaitingState } from "@/lib/broadcasts/waiting-room";
import type { CommunityLink, WaitingPerson } from "@/lib/broadcasts/waiting-room.server";
import CommunityLinkForm from "./CommunityLinkForm";
import WaitingRoom, { CommunityLinkButton } from "./WaitingRoom";
import { exampleCounts } from "./WaitingRoom.examples";

/** The page on tab `state`, showing `people`, with the community's link or none. */
export function WaitingRoomExample({
  state,
  people,
  link,
}: {
  state: WaitingState;
  people: WaitingPerson[];
  link?: CommunityLink;
}) {
  return (
    <Logged>
      {(log) => (
        <>
          <CommunityLinkButton link={link} setLink={(form) => (log("setLink")(form), Promise.resolve({ ok: true }))} />
          <WaitingRoom
            state={state}
            people={people}
            counts={exampleCounts}
            actions={{
              letIn: (form) => (log("letIn")(form), Promise.resolve({ ok: true })),
              dismiss: (form) => (log("dismiss")(form), Promise.resolve({ ok: true })),
              setLink: (form) => (log("setLink")(form), Promise.resolve({ ok: true })),
            }}
          />
        </>
      )}
    </Logged>
  );
}

/** The page's button for the community's link, with `link` or none, its form logged. */
export function CommunityLinkButtonExample({ link }: { link?: CommunityLink }) {
  return (
    <Logged>
      {(log) => (
        <CommunityLinkButton link={link} setLink={(form) => (log("setLink")(form), Promise.resolve({ ok: true }))} />
      )}
    </Logged>
  );
}

/** The form for a new community link, on its own, logged. */
export function CommunityLinkFormExample() {
  return (
    <Logged>
      {(log) => <CommunityLinkForm setLink={(form) => (log("setLink")(form), Promise.resolve({ ok: true }))} />}
    </Logged>
  );
}
