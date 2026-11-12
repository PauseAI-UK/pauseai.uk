"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/Controls";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import Tag from "@/components/ui/Tag";
import { emailSettingsCopy as copy, settingsDate } from "@/lib/content/email-settings";
import type { ContactPermission, Topic } from "@/lib/contact-permissions";
import {
  choiceKey,
  getsTopic,
  settingsTopics,
  stillGets,
  type SettingsTopic,
  type SettingsView,
} from "@/lib/email-settings";
import { phoneWords } from "@/lib/phone";
import styles from "./EmailSettings.module.css";

/** What the page was opened by and for: kept in each form, so the server knows whose page it is. */
type Opened = { kind: "link" | "copy"; token: string };

/** The page's actions, each given its form: those that change anything give the page afresh, or null once its link has run out. */
export type SettingsActions = {
  save: (form: FormData) => Promise<SettingsView | null>;
  lift: (form: FormData) => Promise<SettingsView | null>;
  stopAll: (form: FormData) => Promise<SettingsView | null>;
  unsubscribe: (form: FormData) => Promise<{ done: boolean; view: SettingsView | null }>;
  resend: (form: FormData) => Promise<void>;
};

/** The hidden fields that say whose page a form is from. */
function OpenedBy({ opened }: { opened: Opened }) {
  return (
    <>
      <input type="hidden" name="kind" value={opened.kind} />
      <input type="hidden" name="token" value={opened.token} />
    </>
  );
}

/**
 * A ref for a heading that takes the place of the button just pressed: it
 * takes the focus as it appears, so a screen reader reads it and the
 * keyboard carries on from there. A heading needs tabIndex={-1} to hold it.
 */
export const focusOnMount = (el: HTMLElement | null) => el?.focus();

/** Topics in a sentence: "the UK newsletter and our event emails". */
const inWords = (topics: Topic[]): string => topics.map((t) => copy.inSentence[t]).join(` ${copy.unsubscribe.and} `);

/** An answer's reason in the person's words, with where it came from; nothing for one the page has no words for. */
const reasonWords = (answer: ContactPermission): string =>
  copy.why.reasons[answer.reason]?.(copy.sourceWords(answer.source)) ?? "";

/** Why a topic is on, or since when it's off, in the person's words. */
function why(answer: ContactPermission | null): string {
  if (!answer) return copy.why.nothing;
  const reason = reasonWords(answer);
  if (answer.send === "yes") return `${copy.why.yes} ${reason}`;
  if (answer.reason === "unsubscribed") return `${copy.why.no} ${settingsDate(answer.at)}: ${reason}`;
  return reason || copy.why.nothing;
}

/** A topic's lozenge: they get it some way; or not, as all email is held; or it's off. */
function TopicTag({ topic }: { topic: SettingsTopic }) {
  if (getsTopic(topic)) return <Tag tone="green">{copy.tags.on}</Tag>;
  if (topic.boxes.some((box) => box.locked)) return <Tag tone="amber">{copy.tags.paused}</Tag>;
  return <Tag>{copy.tags.off}</Tag>;
}

/** One topic: its name, whether they get it, what it is, a box for each way, and why. */
function TopicCard({ topic }: { topic: SettingsTopic }) {
  const [boxes, setBoxes] = useState(topic.boxes);
  return (
    <fieldset className={styles.card}>
      <legend className={styles.topic}>
        {copy.topics[topic.topic]} <TopicTag topic={topic} />
      </legend>
      <p className={styles.what}>{copy.about[topic.topic]}</p>
      <div className={styles.ways}>
        {boxes.map((box, i) => (
          <Checkbox
            key={box.way}
            name="choice"
            value={choiceKey(topic.topic, box.way)}
            checked={box.on}
            disabled={box.locked}
            onChange={(on) => setBoxes(boxes.map((b, j) => (j === i ? { ...b, on } : b)))}
          >
            {copy.ways[box.way]}
          </Checkbox>
        ))}
      </div>
      <p className={styles.why}>{why(topic.why)}</p>
    </fieldset>
  );
}

/** What holds all the address's email: "No bulk emails", which they can lift here, "Do not email", or a block. */
function Hold({
  view,
  opened,
  lift,
  focus,
}: {
  view: SettingsView;
  opened: Opened;
  lift: (form: FormData) => Promise<void>;
  /** Whether it takes the focus as it appears, as Stop everything made it. */
  focus: boolean;
}) {
  const hold = view.hold!;
  if (hold.kind === "no-bulk") {
    return (
      <FormStack className={`${styles.held} ${styles.buttonForm}`} action={lift}>
        <OpenedBy opened={opened} />
        <h2 ref={focus ? focusOnMount : undefined} tabIndex={-1}>
          {copy.noBulk.title}
        </h2>
        <p className={styles.boxText}>{copy.noBulk.body(hold.at)}</p>
        <p className={styles.boxText}>{copy.noBulk.note}</p>
        <SubmitButton variant="ghost" fit>
          {copy.noBulk.button}
        </SubmitButton>
      </FormStack>
    );
  }
  const words = hold.kind === "do-not-email" ? copy.doNotEmail : copy.blocked;
  return (
    <div className={styles.held}>
      <h2>{words.title}</h2>
      <p className={styles.boxText}>{words.body}</p>
    </div>
  );
}

/** The box an email's unsubscribe link opens the page with: one button, then what it did, and what they still get. */
function Unsubscribe({
  topics,
  view,
  opened,
  unsubscribe,
}: {
  topics: Topic[];
  view: SettingsView | null;
  opened: Opened;
  unsubscribe: (form: FormData) => Promise<void>;
}) {
  const [done, setDone] = useState(false);
  if (!done) {
    return (
      <FormStack
        className={`${styles.unsubscribe} ${styles.buttonForm}`}
        action={async (form) => {
          await unsubscribe(form);
          setDone(true);
        }}
      >
        <OpenedBy opened={opened} />
        <h2>{copy.unsubscribe.title(inWords(topics))}</h2>
        <SubmitButton variant="primary" fit>
          {copy.unsubscribe.button}
        </SubmitButton>
      </FormStack>
    );
  }
  const still = view ? stillGets(view, topics) : [];
  return (
    <div className={styles.unsubscribe} role="status">
      <h2 ref={focusOnMount} tabIndex={-1}>
        {copy.unsubscribe.done(inWords(topics))}
      </h2>
      <p>{copy.unsubscribe.doneBody}</p>
      {still.map((answer) => (
        <p key={answer.topic}>{copy.unsubscribe.still(copy.topics[answer.topic], reasonWords(answer))}</p>
      ))}
    </div>
  );
}

/** A page whose link has run out: an email's button still works, but for the rest, a fresh link. */
function Expired({ opened, resend }: { opened: Opened; resend: SettingsActions["resend"] }) {
  const [sent, setSent] = useState(false);
  return (
    <div className={`${styles.card} ${styles.offer}`}>
      <h2>{opened.kind === "copy" ? copy.pageExpired : copy.expired.title}</h2>
      {opened.kind === "link" && <p className={styles.boxText}>{copy.expired.body}</p>}
      {sent ? (
        <p className={styles.boxText} role="status" ref={focusOnMount} tabIndex={-1}>
          {copy.expired.sent}
        </p>
      ) : (
        <FormStack
          className={styles.buttonForm}
          action={async (form) => {
            await resend(form);
            setSent(true);
          }}
        >
          <OpenedBy opened={opened} />
          <SubmitButton variant="ghost" fit>
            {copy.expired.button}
          </SubmitButton>
        </FormStack>
      )}
    </div>
  );
}

/**
 * The email settings page: from an email's unsubscribe link, its box first;
 * then what PauseAI UK sends the address and its numbers, a topic a card,
 * with what holds all its email above them; Save; what PauseAI Global
 * sends; and Stop everything. Once its link has run out, an offer of a
 * fresh one in place of all but the box.
 */
export default function EmailSettings({
  opened,
  unsubscribe,
  initial,
  actions,
}: {
  opened: Opened;
  /** What an email's unsubscribe link opts out of, or null for a page opened by a link asked for. */
  unsubscribe: Topic[] | null;
  initial: SettingsView | null;
  actions: SettingsActions;
}) {
  const [view, setView] = useState(initial);
  const [saved, setSaved] = useState(false);
  // Each change gives fresh boxes, so the cards start again from what was kept.
  const [round, setRound] = useState(0);
  // Where the focus goes once a button's change is shown: the page's title after a lift, the hold after Stop everything.
  const [focus, setFocus] = useState<"title" | "hold" | null>(null);
  const update = (next: SettingsView | null, then: typeof focus = null) => {
    setView(next);
    setRound((n) => n + 1);
    setFocus(then);
  };
  return (
    <>
      {unsubscribe && (
        <Unsubscribe
          topics={unsubscribe}
          view={view}
          opened={opened}
          unsubscribe={async (form) => update((await actions.unsubscribe(form)).view)}
        />
      )}
      {!view ? (
        <Expired opened={opened} resend={actions.resend} />
      ) : (
        <>
          <h1 ref={focus === "title" ? focusOnMount : undefined} tabIndex={-1} key={`title-${round}`}>
            {copy.settings.title}
          </h1>
          <p className={styles.lead}>{copy.settings.lead(view.address)}</p>
          {view.hold && (
            <Hold
              view={view}
              opened={opened}
              lift={async (form) => update(await actions.lift(form), "title")}
              focus={focus === "hold"}
            />
          )}
          <FormStack
            action={async (form) => {
              // Cleared first, so each save's "Saved" is news a screen reader reads.
              setSaved(false);
              update(await actions.save(form));
              setSaved(true);
            }}
          >
            <OpenedBy opened={opened} />
            {settingsTopics(view).map((topic) => (
              <TopicCard key={`${topic.topic}-${round}`} topic={topic} />
            ))}
            {view.numbers.length > 0 && (
              <p className={styles.quiet}>{copy.numbers(view.numbers.map(phoneWords).join(", "))}</p>
            )}
            <div className={styles.row}>
              <SubmitButton variant="primary" fit>
                {copy.settings.save}
              </SubmitButton>
              <span className={styles.quiet} role="status">
                {saved ? copy.settings.saved : copy.settings.saveNote}
              </span>
            </div>
          </FormStack>
          <section className={styles.global} aria-labelledby="global">
            <h2 id="global">{copy.global.title}</h2>
            <p>{copy.global.intro}</p>
            <ul>
              {copy.global.lists.map((list) => (
                <li key={list}>{list}</li>
              ))}
            </ul>
            <p>
              {copy.global.howToStop}
              {!view.hold && ` ${copy.global.stopAll}`}
            </p>
          </section>
          {!view.hold && (
            <section className={styles.stopAll} aria-labelledby="stop-all">
              <h2 id="stop-all">{copy.stopAll.title}</h2>
              <p>{copy.stopAll.body}</p>
              <FormStack
                className={styles.buttonForm}
                action={async (form) => update(await actions.stopAll(form), "hold")}
              >
                <OpenedBy opened={opened} />
                <SubmitButton variant="ghost" fit>
                  {copy.stopAll.button}
                </SubmitButton>
              </FormStack>
            </section>
          )}
        </>
      )}
    </>
  );
}
