"use client";

import { useState, type ReactNode } from "react";
import { useSavedChoice } from "@/components/ui/useSave";
import { Checkbox } from "@/components/ui/Controls";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SaveState } from "@/components/ui/SaveState";
import Bubble from "@/components/ui/Bubble";
import ChannelIcon from "@/components/ui/ChannelIcon";
import { iconButtonClass } from "@/components/ui/IconButton";
import { emailSettingsCopy as copy } from "@/lib/content/email-settings";
import { site } from "@/lib/content/site";
import type { ContactPermission, Topic } from "@/lib/supporters/contact-permissions";
import {
  choiceKey,
  isNumber,
  LUMA_CHOICE,
  LUMA_OFFERED,
  numberHolds,
  settingsTopics,
  topicAnswers,
  type SettingsChanged,
  type SettingsTopic,
  type SettingsView,
  type Unsubscribed,
} from "@/lib/supporters/settings-view";
import styles from "./EmailSettings.module.css";

/**
 * What the page was opened by and for: kept in each form, so the server
 * knows whose page it is. `number`, a link for a number alone, from the
 * answer to a stop.
 */
type Opened = { kind: "link" | "copy"; token: string; number?: boolean };

/** The page's actions, each given its form: those that change anything give the page afresh, or refuse once its link has run out. */
export type SettingsActions = {
  save: (form: FormData) => Promise<SettingsChanged>;
  lift: (form: FormData) => Promise<SettingsChanged>;
  stopAll: (form: FormData) => Promise<SettingsChanged>;
  unsubscribe: (form: FormData) => Promise<Unsubscribed>;
  resend: (form: FormData) => Promise<unknown>;
};

/** The page after a change: afresh, or null once its link has run out. */
const viewAfter = (changed: SettingsChanged): SettingsView | null => (changed.ok ? changed.view : null);

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

/** What an email's link stops (unsubscribeTopics), in a sentence: Volunteering for an email to it, else Updates. */
const inWords = (topics: Topic[]): string =>
  copy.inSentence[topics.includes("volunteering") ? "volunteering" : "newsletter"];

/**
 * An answer's reason in the person's words, with where it came from; nothing
 * for one the page has no words for. Being on PauseAI Global's volunteering
 * list is saying so when joining, which is how its join form puts them there.
 */
const reasonWords = (answer: ContactPermission): string => {
  const reason = answer.reason === "subscribed" ? "volunteered" : answer.reason;
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

/** Where the last change to a topic's boxes is: being saved, saved, or not saved, as saving it failed. */
type Saving = "saving" | "saved" | "failed";

/** The boxes ticked in what's saved: each topic's ways that are on, and Luma's while they're on our calendar. */
function tickedIn(view: SettingsView | null): ReadonlySet<string> {
  if (!view) return new Set();
  const ways = settingsTopics(view).flatMap((topic) =>
    topic.boxes.filter((box) => box.on).map((box) => choiceKey(topic.topic, box.way)),
  );
  return new Set(view.onLuma ? [...ways, LUMA_CHOICE] : ways);
}

/** The boxes ticked in the form, as a change of one sends it. */
function tickedInForm(form: FormData): ReadonlySet<string> {
  return new Set(form.getAll("choice").map(String));
}

/** Does nothing: a box's change is heard by the form around it, which saves every box and says which are ticked. */
const heardByForm = () => {};

/**
 * One topic: its name, whether they get it, what it is, a box for each way,
 * ticked if it's among those `ticked`, whether its last change is saved, and
 * why. A box that can't be changed shows what's saved.
 */
function TopicCard({
  topic,
  ticked,
  saving,
}: {
  topic: SettingsTopic;
  ticked: ReadonlySet<string>;
  saving: Saving | null;
}) {
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
        {topic.boxes.map((box) => (
          <Checkbox
            key={box.way}
            name="choice"
            value={choiceKey(topic.topic, box.way)}
            checked={box.locked ? box.on : ticked.has(choiceKey(topic.topic, box.way))}
            disabled={box.locked}
            boxed
            onChange={heardByForm}
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

/**
 * Luma's own emails: whether the address stays on our Luma calendar, one
 * box, `ticked` while it's on; unticked, saving takes them off. While
 * they're on it (`on`), why, as a topic's card says it: they follow our
 * calendar.
 * Once they're off (`off`), it can't be ticked again, as only Luma can put
 * them back on, and it says so. Not while all its email is held (`held`).
 */
function LumaCard({
  on,
  ticked,
  held,
  off,
  saving,
}: {
  on: boolean;
  ticked: boolean;
  held: boolean;
  off: boolean;
  saving: Saving | null;
}) {
  const reason = on && (
    <>
      <strong>{copy.why.yes}</strong> {copy.why.reasons.following!("")}
    </>
  );
  return (
    <fieldset className={styles.card}>
      <legend className={styles.topic}>
        <span>{copy.topics.events}</span>
        {reason && (
          <span className={`${styles.askWrap} ${styles.phoneOnly}`}>
            <Bubble id="why-luma" label="?" trigger={iconButtonClass("outline", styles.ask)} name={copy.why.ask}>
              {reason}
            </Bubble>
          </span>
        )}
      </legend>
      <p className={styles.what}>{copy.about.events}</p>
      <div className={styles.ways}>
        <input type="hidden" name="choice" value={LUMA_OFFERED} />
        <Checkbox
          name="choice"
          value={LUMA_CHOICE}
          checked={held || off ? on : ticked}
          disabled={held || off}
          boxed
          onChange={heardByForm}
        >
          {copy.lumaBox}
        </Checkbox>
        <span className={styles.saving} role="status">
          {saving && <SaveState state={saving}>{copy.settings[saving]}</SaveState>}
        </span>
      </div>
      {reason && <p className={`${styles.why} ${styles.wideOnly}`}>{reason}</p>}
      {off && (
        <p className={styles.why}>
          {copy.lumaOff.body} <a href={site.social.luma}>{copy.lumaOff.link}</a>.
        </p>
      )}
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

/**
 * Whether the address already gets none of `topics` by email, as after the
 * link's button, or a reload after it: for PauseAI UK Updates, a yes to
 * `events` is getting it, as PauseAI UK Updates inc. Luma (topicAnswers).
 */
const offAlready = (view: SettingsView | null, topics: Topic[]): boolean =>
  view !== null && topics.every((topic) => topicAnswers(view, topic).some((a) => a.way === "email" && a.send === "no"));

/**
 * The box an email's unsubscribe link opens the page with: one button, then
 * what it did; or, where they get none of its topics already, that they're
 * not subscribed, with no button.
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
        {copy.unsubscribe.doneBody()}
        {view && ` ${copy.unsubscribe.below}`}
      </p>
    </div>
  );
}

/**
 * A page whose link has run out: an email's button still works, but for the
 * rest, a fresh link; for a number's, which has no address to email it to,
 * how to stop texts instead.
 */
function Expired({ opened, resend }: { opened: Opened; resend: SettingsActions["resend"] }) {
  const [sent, setSent] = useState(false);
  if (opened.number) {
    return (
      <div className={`${styles.card} ${styles.offer}`}>
        <h2>{copy.expired.title}</h2>
        <p className={styles.boxText}>{copy.numberExpired}</p>
      </div>
    );
  }
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

/**
 * PauseAI Global's own emails, mostly Critical Alerts, in a small grey card
 * after the topics': how to stop them, and, only while Stop everything is
 * offered (not `held`), that it stops them all too.
 */
function GlobalEmails({ held }: { held: boolean }) {
  return (
    <section className={`${styles.card} ${styles.global}`} aria-labelledby="global">
      <h2 id="global" className={styles.topic}>
        {copy.global.title}
      </h2>
      <p className={styles.what}>
        {copy.global.body}
        {!held && ` ${copy.global.stopAll}`}
      </p>
    </section>
  );
}

/**
 * The contact preferences page: from an email's unsubscribe link, its box
 * first, until anything below it changes; then what PauseAI UK sends the
 * address and its numbers, a topic a card, the numbers unnamed, as the link
 * doesn't prove they're the person's; each saved as it's changed, with what
 * holds all its email or texts and calls above them; what PauseAI Global
 * sends; and Stop everything. Once its link has run out, an offer of a fresh
 * one in place of all but the box. A number's page, from the answer to a
 * stop, has the number's texts and calls alone, the number shown, as the
 * link went only to it.
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
  // Whether the page opened for someone on our Luma calendar, so its card stays while they're on the page.
  const [onLuma] = useState(Boolean(initial?.onLuma));
  // Each change gives fresh boxes, so the cards start again from what was kept.
  const [round, setRound] = useState(0);
  // Where the focus goes once a button's change is shown: the page's title after a lift, the hold after Stop everything.
  const [focus, setFocus] = useState<"title" | "hold" | null>(null);
  // The topic last changed, and where its change is: saved only once every save still going is, and not saved if
  // one failed.
  const [lastChanged, setLastChanged] = useState<Topic | null>(null);
  // The boxes ticked: as the form had them at the last change, while it's being saved, then as what's saved
  // has them, so a change that didn't save goes back.
  const [ticked, save, savingNow, notSaved] = useSavedChoice(tickedIn(view), actions.save, tickedInForm, {
    done: (changed) => setView(viewAfter(changed)),
  });
  const saving: { topic: Topic; state: Saving } | null = lastChanged && {
    topic: lastChanged,
    state: savingNow ? "saving" : notSaved ? "failed" : "saved",
  };
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
  // A number's page, its texts and calls alone: none of PauseAI Global's emails, nor Stop everything.
  const forNumber = view !== null && isNumber(view.address);
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
          {/* Whose settings these are: the address alone, or the number, which says it plainly enough. */}
          <p className={styles.address}>
            <ChannelIcon channel={forNumber ? "phone" : "email"} size={20} />
            {view.address}
          </p>
          {view.hold && (
            <Hold
              view={view}
              opened={opened}
              lift={async (form) => changeBelow(viewAfter(await actions.lift(form)), "title")}
              focus={focus === "hold"}
            />
          )}
          <NumberHolds view={view} />
          {/*
            Each box saves as it's changed, with every box as it is then, and
            shows the change while it's saved (useSavedChoice). Not by the
            form's action, as that waits for a submit.
          */}
          <FormStack
            onChange={(event) => {
              const value = (event.target as unknown as HTMLInputElement).value;
              setLastChanged((value === LUMA_CHOICE ? "events" : value.split(":")[0]) as Topic);
              setChanged(true);
              save(new FormData(event.currentTarget));
            }}
          >
            <OpenedBy opened={opened} />
            {settingsTopics(view).map((topic) => (
              <TopicCard
                key={`${topic.topic}-${round}`}
                topic={topic}
                ticked={ticked}
                saving={saving?.topic === topic.topic ? saving.state : null}
              />
            ))}
            {/* Shown to someone on our Luma calendar when the page opened, so it stays once they've come off. */}
            {onLuma && (
              <LumaCard
                key={`luma-${round}`}
                on={view.onLuma}
                ticked={ticked.has(LUMA_CHOICE)}
                held={view.hold !== null}
                off={!view.onLuma && view.hold === null}
                saving={saving?.topic === "events" ? saving.state : null}
              />
            )}
          </FormStack>
          {!forNumber && <GlobalEmails held={Boolean(view.hold)} />}
          {!view.hold && !forNumber && (
            <section className={styles.stopAll} aria-labelledby="stop-all">
              <h2 id="stop-all">{copy.stopAll.title}</h2>
              <p>{copy.stopAll.body}</p>
              <FormStack
                className={styles.buttonForm}
                action={async (form) => changeBelow(viewAfter(await actions.stopAll(form)), "hold")}
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
