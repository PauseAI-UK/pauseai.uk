import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import type { WaitingPerson } from "@/lib/broadcasts/waiting-room.server";
import { Card } from "../ui/Grid";
import StaffLink from "../ui/StaffLink";
import { WAITING_ROOM_PATH, WaitingChat } from "./WaitingRoom";

const copy = waitingRoomCopy.page;

/**
 * A supporter's chat with the WhatsApp waiting room, a card of their page,
 * if they came through it, with a link to its page's tab of where they
 * are; else nothing.
 */
export default function SupporterWaitingRoom({ person }: { person?: WaitingPerson }) {
  if (!person) return null;
  return (
    <Card
      title={copy.chat}
      id="waiting-room"
      action={<StaffLink href={`${WAITING_ROOM_PATH}?show=${person.state}`}>{copy.tabs[person.state]}</StaffLink>}
    >
      <WaitingChat person={person} />
    </Card>
  );
}
