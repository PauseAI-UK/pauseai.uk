"use client";

import { useRef, useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/Controls";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SaveState } from "@/components/ui/SaveState";
import Bubble from "@/components/ui/Bubble";
import ChannelIcon from "@/components/ui/ChannelIcon";
import { iconButtonClass } from "@/components/ui/IconButton";
import { emailSettingsCopy as copy } from "@/lib/content/email-settings";
import { site } from "@/lib/content/site";
import type { ContactPermission, Topic } from "@/lib/contact-permissions";
import { choiceKey, numberHolds, settingsTopics, type SettingsTopic, type SettingsView } from "@/lib/email-settings";
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

/**
 * An answer's reason in the person's words, with where it came from; nothing
 * for one the page has no words for. Being on PauseAI Global's volunteering
 * list is saying so when joining, which is how its join form puts them there.
 */
const reasonWords = (answer: ContactPermission): string => {
  const reason = answer.reason === "subscribed" && answer.topic === "volunteering" ? "volunteered" : answer.reason;
  return copy.why.reasons[reason]?.(copy.sourceWords(answer.source)) ?? "";
};

/**
 * Why a topic is on or off, after a bold "Why:", in the person's words: that
 * they never asked, where there's no answer or a no the page has no words
 * for, such as CiviCRM's "not opted in"; null for a yes it has no words for.
 */
function why(answer: ContactPermission | null): ReactNode {
  const unasked = !answer || answer.send === "no" ? copy.why.unasked : "";
  const reason = (answer && reasonWords(answer)) || unasked;
  if (!reason) return null;
  return (
    <>
      <strong>{copy.why.yes}</strong> {reason}
    </>
  );
}

/** Where the last change to a topic's boxes is: being saved, or saved. */
type Saving = "saving" | "saved";

/**
 * One topic: its name, whether they get it, what it is, a box for each way,
 * whether its last change is saved, and why.
 */
function TopicCard({ topic, saving }: { topic: SettingsTopic; saving: Saving | null }) {
  const [boxes, setBoxes] = useState(topic.boxes);
  const reason = why(topic.why);
  return (
    <fieldset className={styles.card}>
      <legend className={styles.topic}>
        <span>{copy.topics[topic.topic]}</span>
        {reason && (
          <span className={`${styles.askWrap} ${styles.phoneOnly}`}>
            <Bubble
              id={`why-${topic.topic}`}
              label="?"
              trigger={iconButtonClass("outline", styles.ask)}
              name={copy.why.ask}
            >
              {reason}
            </Bubble>
          </span>
        )}
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
            boxed
            onChange={(on) => setBoxes(boxes.map((b, j) => (j === i ? { ...b, on } : b)))}
          >
            {copy.ways[box.way]}
          </Checkbox>
        ))}
        {/* Beside the boxes, there before it says anything, so a screen reader hears each change of it. */}
        <span className={styles.saving} role="status">
          {saving && <SaveState state={saving}>{copy.settings[saving]}</SaveState>}
        </span>
      </div>
      {reason && <p className={`${styles.why} ${styles.wideOnly}`}>{reason}</p>}
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
    // As Stop everything set it, its words are of everything, and its button restarts it all.
    const words = hold.everything ? copy.stopped : copy.noBulk;
    return (
      <FormStack className={`${styles.held} ${styles.buttonForm}`} action={lift}>
        <OpenedBy opened={opened} />
        <h2 ref={focus ? focusOnMount : undefined} tabIndex={-1}>
          {words.title}
        </h2>
        <p className={styles.boxText}>{words.body}</p>
        <SubmitButton variant="ghost" fit>
          {words.button}
        </SubmitButton>
      </FormStack>
    );
  }
  const blocked = hold.kind === "blocked";
  return (
    <div className={styles.held}>
      <h2>{blocked ? copy.blocked.title : copy.doNotEmail.title}</h2>
      {/*
        One paragraph: what holds it, whether texts and calls still go, and
        who can lift it: staff, for a block, whom they can email; PauseAI
        Global, for "Do not email".
      */}
      <p className={styles.boxText}>
        {blocked ? copy.blocked.body : <OnlyGlobal />}
        {view.numbers.length > 0 && ` ${copy.numbersStill}`}
        {blocked && (
          <>
            {" "}
            {copy.blocked.ask} <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
          </>
        )}
      </p>
    </div>
  );
}

/** That only PauseAI Global can lift it, and a link to its contact page. */
function OnlyGlobal() {
  const words = copy.onlyGlobal;
  return (
    <>
      {words.body} <a href={words.url}>{words.link}</a>.
    </>
  );
}

/** What PauseAI Global stops to every number of theirs (numberHolds), texts, calls or both, in a box as email's are. */
function NumberHolds({ view }: { view: SettingsView }) {
  const ways = numberHolds(view);
  if (!ways.length) return null;
  const words = ways.length === 2 ? copy.doNotTextOrCall : ways[0] === "text" ? copy.doNotText : copy.doNotCall;
  return (
    <div className={styles.held}>
      <h2>{words.title}</h2>
      <p className={styles.boxText}>
        <OnlyGlobal />
      </p>
    </div>
  );
}

/** Whether the address already gets none of `topics` by email, as after the link's button, or a reload after it. */
const offAlready = (view: SettingsView | null, topics: Topic[]): boolean =>
  view !== null &&
  topics.every((topic) => view.answers.some((a) => a.way === "email" && a.topic === topic && a.send === "no"));

/**
 * The box an email's unsubscribe link opens the page with: one button, then
 * what it did, and what they still get; that straight away, where they get
 * none of its topics already.
 */
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
  // Pressed here, or found so on opening.
  const [done, setDone] = useState<"pressed" | "already" | null>(() => (offAlready(view, topics) ? "already" : null));
  if (!done) {
    return (
      <FormStack
        className={`${styles.unsubscribe} ${styles.buttonForm}`}
        action={async (form) => {
          await unsubscribe(form);
          setDone("pressed");
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
  // Found so on opening, it says only that they don't get them, which is true whatever the reason: they may never have.
  if (done === "already") {
    return (
      <div className={styles.unsubscribe}>
        <h2>{copy.unsubscribe.off(inWords(topics))}</h2>
        <p>{copy.unsubscribe.offBelow}</p>
      </div>
    );
  }
  return (
    <div className={styles.unsubscribe} role="status">
      <h2 ref={focusOnMount} tabIndex={-1}>
        {copy.unsubscribe.done(inWords(topics))}
      </h2>
      {/* Pointing to the choices below, where the page has them: an old email's link offers a fresh link instead. */}
      <p>
        {copy.unsubscribe.doneBody}
        {view && ` ${copy.unsubscribe.below}`}
      </p>
    </div>
  );
}

/** A page whose link has run out: an email's button still works, but for the rest, a fresh link. */
function Expired({ opened, resend }: { opened: Opened; resend: SettingsActions["resend"] }) {
  const [sent, setSent] = useState(false);
  const words = opened.kind === "copy" ? copy.pageExpired : copy.expired;
  return (
    <div className={`${styles.card} ${styles.offer}`}>
      <h2>{words.title}</h2>
      <p className={styles.boxText}>{words.body}</p>
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

/** What PauseAI Global sends, and how to stop it; how to stop it all only while Stop everything is offered (not `held`). */
function GlobalEmails({ held }: { held: boolean }) {
  return (
    <>
      <p>{copy.global.intro}</p>
      <ul>
        {copy.global.lists.map((list) => (
          <li key={list}>{list}</li>
        ))}
      </ul>
      <p>
        {copy.global.howToStop}
        {!held && ` ${copy.global.stopAll}`}
      </p>
    </>
  );
}

/**
 * The contact preferences page: from an email's unsubscribe link, its box first;
 * then what PauseAI UK sends the address and its numbers, a topic a card,
 * the numbers unnamed, as the link doesn't prove they're the person's;
 * each saved as it's changed, with what holds all its email above them;
 * what PauseAI Global
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
  // Each change gives fresh boxes, so the cards start again from what was kept.
  const [round, setRound] = useState(0);
  // Where the focus goes once a button's change is shown: the page's title after a lift, the hold after Stop everything.
  const [focus, setFocus] = useState<"title" | "hold" | null>(null);
  // The topic last changed, and whether its change is saved yet; saves still going, so it's saved only once all are.
  const [saving, setSaving] = useState<{ topic: Topic; state: Saving } | null>(null);
  const going = useRef(0);
  // Whether anything below the email's box has changed, which may make what the box says untrue, so it goes.
  const [changed, setChanged] = useState(false);
  const update = (next: SettingsView | null, then: typeof focus = null) => {
    setView(next);
    setRound((n) => n + 1);
    setFocus(then);
  };
  const changeBelow = (next: SettingsView | null, then: typeof focus) => {
    setChanged(true);
    update(next, then);
  };
  return (
    <>
      {unsubscribe && !changed && (
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
          {/* Whose settings these are: the address alone, which says it plainly enough. */}
          <p className={styles.address}>
            <ChannelIcon channel="email" size={20} />
            {view.address}
          </p>
          {view.hold && (
            <Hold
              view={view}
              opened={opened}
              lift={async (form) => changeBelow(await actions.lift(form), "title")}
              focus={focus === "hold"}
            />
          )}
          <NumberHolds view={view} />
          {/*
            Each box saves as it's changed, with every box as it is then. Not by
            the form's action, as React resets a form after one, which would put
            the boxes back as the page first drew them.
          */}
          <FormStack
            onChange={async (event) => {
              const topic = (event.target as unknown as HTMLInputElement).value.split(":")[0] as Topic;
              const form = new FormData(event.currentTarget);
              setSaving({ topic, state: "saving" });
              setChanged(true);
              going.current++;
              const next = await actions.save(form);
              going.current--;
              // The boxes stay as they are, so a change made while this one was saved isn't undone.
              setView(next);
              if (!going.current) setSaving((was) => was && { ...was, state: "saved" });
            }}
          >
            <OpenedBy opened={opened} />
            {settingsTopics(view).map((topic) => (
              <TopicCard
                key={`${topic.topic}-${round}`}
                topic={topic}
                saving={saving?.topic === topic.topic ? saving.state : null}
              />
            ))}
          </FormStack>
          {/* Open on a wide screen; folded to its heading on a phone, as it's for reading rather than changing anything. */}
          <section className={`${styles.global} ${styles.wide}`} aria-labelledby="global">
            <h2 id="global">{copy.global.title}</h2>
            <GlobalEmails held={Boolean(view.hold)} />
          </section>
          <details className={`${styles.global} ${styles.narrow}`}>
            <summary>
              <h2>{copy.global.title}</h2>
            </summary>
            <GlobalEmails held={Boolean(view.hold)} />
          </details>
          {!view.hold && (
            <section className={styles.stopAll} aria-labelledby="stop-all">
              <h2 id="stop-all">{copy.stopAll.title}</h2>
              <p>{copy.stopAll.body}</p>
              <FormStack
                className={styles.buttonForm}
                action={async (form) => changeBelow(await actions.stopAll(form), "hold")}
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
