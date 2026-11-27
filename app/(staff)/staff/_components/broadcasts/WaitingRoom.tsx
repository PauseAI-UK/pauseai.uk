import { TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormResult } from "@/lib/form-result";
import { phoneWords } from "@/lib/phone";
import { staffTime } from "@/lib/staff-time";
import { waitingRoomCopy } from "@/lib/broadcasts/waiting-room-copy";
import { WAITING_STATES, type WaitingState } from "@/lib/broadcasts/waiting-room";
import type { CommunityLink, DecisionRefusal, WaitingPerson } from "@/lib/broadcasts/waiting-room.server";
import { ChatBubble, ChatWall, LinkedText } from "./TextBubble";
import Empty from "../ui/Empty";
import Grid, { Card } from "../ui/Grid";
import { Refusal, ResultForm } from "../ui/ResultForm";
import StaffLink from "../ui/StaffLink";
import { StaffSentence } from "../ui/StaffMember";
import Tabs from "../ui/Tabs";
import styles from "./WaitingRoom.module.css";

const copy = waitingRoomCopy.page;

/** Where the page is, and which of its tabs. */
export const WAITING_ROOM_PATH = "/staff/supporters/waiting-room";

/** The Server Actions the page's buttons send. */
export type WaitingRoomActions = {
  letIn: (form: FormData) => Promise<FormResult<DecisionRefusal>>;
  dismiss: (form: FormData) => Promise<FormResult<"gone">>;
  setLink: (form: FormData) => Promise<FormResult<"not-a-link">>;
};

/** Who someone is: their WhatsApp name, else their number as people here write it. */
const whoOf = (person: WaitingPerson) => person.profileName || phoneWords(person.number);

/** A chat, as WhatsApp shows it: theirs at the left, ours at the right in green. */
export function WaitingChat({ person }: { person: WaitingPerson }) {
  return (
    <ChatWall>
      {person.messages.map((message) => (
        <ChatBubble key={message.id} ours={message.ours} when={staffTime(message.at)}>
          {message.body ? <LinkedText text={message.body} /> : <em>{message.kind}</em>}
        </ChatBubble>
      ))}
    </ChatWall>
  );
}

/** Who decided, and when: a staff member, or the check. */
function Decided({ person }: { person: WaitingPerson }) {
  const when = staffTime(person.decidedAt!);
  if (!person.decidedBy) return <p className={styles.quiet}>{copy.letInByCheck(when)}</p>;
  const words = person.state === "dismissed" ? copy.dismissedBy : copy.letInBy;
  return (
    <p className={styles.quiet}>
      <StaffSentence words={(who) => words(who, when)} email={person.decidedBy} />
    </p>
  );
}

/** Let in and Dismiss, for someone held or who hasn't replied. */
function Buttons({ person, actions }: { person: WaitingPerson; actions: WaitingRoomActions }) {
  return (
    <div className={styles.buttons}>
      <ResultForm action={actions.letIn} says={copy.refused} atTop={["gone"]}>
        <input type="hidden" name="id" value={person.id} />
        <SubmitButton variant="primary" size="small">
          {copy.letIn}
        </SubmitButton>
        <Refusal />
      </ResultForm>
      <ResultForm action={actions.dismiss} says={{ gone: copy.refused.gone }} atTop={["gone"]}>
        <input type="hidden" name="id" value={person.id} />
        <SubmitButton variant="ghost" size="small">
          {copy.dismiss}
        </SubmitButton>
        <Refusal />
      </ResultForm>
    </div>
  );
}

/** One person: who, where from and when; their chat; and what's become of them, or the buttons to decide. */
function Person({ person, actions }: { person: WaitingPerson; actions: WaitingRoomActions }) {
  const facts = [phoneWords(person.number), person.cameFrom && copy.from(person.cameFrom), staffTime(person.askedAt)];
  return (
    <Card span={6} title={whoOf(person)} id={`waiting-${person.id}`}>
      <p className={styles.quiet}>{facts.filter(Boolean).join(" · ")}</p>
      <WaitingChat person={person} />
      {person.state === "held" && (
        <p>
          <strong>{copy.heldWhy}:</strong> {person.heldWhy ?? copy.heldUnasked}
        </p>
      )}
      {person.decidedAt ? <Decided person={person} /> : <Buttons person={person} actions={actions} />}
      {person.state === "let-in" && !person.linkSentAt && <p className={styles.quiet}>{copy.linkWaiting}</p>}
      {person.supporterId && <StaffLink href={`/staff/supporters/${person.supporterId}`}>{copy.supporter}</StaffLink>}
    </Card>
  );
}

/** The community's link, who set it and when, and the form to set another. */
function LinkCard({ link, setLink }: { link?: CommunityLink; setLink: WaitingRoomActions["setLink"] }) {
  return (
    <Card title={copy.link.title} id="waiting-room-link" look="aside">
      {link ? (
        <>
          <p className={styles.link}>{link.link}</p>
          <p className={styles.quiet}>
            <StaffSentence words={(who) => copy.link.setBy(who, staffTime(link.setAt))} email={link.setBy} />
          </p>
        </>
      ) : (
        <p>{copy.link.none}</p>
      )}
      <ResultForm action={setLink} says={copy.refused} stack>
        <Field label={copy.link.label}>
          <TextInput name="link" type="url" required aria-describedby="waiting-room-link-hint" />
        </Field>
        <Hint id="waiting-room-link-hint">{copy.link.hint}</Hint>
        <Refusal />
        <SubmitButton variant="primary" size="small" fit>
          {copy.link.save}
        </SubmitButton>
      </ResultForm>
    </Card>
  );
}

/**
 * The WhatsApp waiting room: the community's link and the form to change
 * it; then tabs of who's held, let in, dismissed or hasn't replied, with how
 * many where there are any; and the tab's people, each with their chat, and for those not yet
 * decided, buttons to let them in or dismiss them.
 */
export default function WaitingRoom({
  state,
  people,
  counts,
  link,
  actions,
}: {
  state: WaitingState;
  people: WaitingPerson[];
  counts: Record<WaitingState, number>;
  link?: CommunityLink;
  actions: WaitingRoomActions;
}) {
  const tabs = WAITING_STATES.map((key) => ({
    key,
    label: copy.tabs[key],
    href: key === "held" ? WAITING_ROOM_PATH : `${WAITING_ROOM_PATH}?show=${key}`,
    // A tab with nobody in it says so by having no count.
    badge: counts[key] || undefined,
  }));
  return (
    <>
      <LinkCard link={link} setLink={actions.setLink} />
      <Tabs label={copy.tabsLabel} tabs={tabs} current={state} />
      {people.length === 0 ? (
        <Empty>{copy.none[state]}</Empty>
      ) : (
        <Grid>
          {people.map((person) => (
            <Person key={person.id} person={person} actions={actions} />
          ))}
        </Grid>
      )}
    </>
  );
}
