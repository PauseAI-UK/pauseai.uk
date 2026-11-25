"use client";

import type { JSONContent } from "@tiptap/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { useSave, useSavedChoice } from "@/components/ui/useSave";
import type { FormResult } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import MenuSelect, { type MenuOption } from "../ui/MenuSelect";
import { DeleteTwice } from "../ui/DeleteTwice";
import { Field, FieldError, Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { useLeaving } from "@/components/ui/useLeaving";
import { now } from "@/lib/now";
import { looksLikeEmail } from "@/lib/email-address";
import { leavePage } from "@/lib/leave-page.client";
import {
  checkMailingDoc,
  conditionsIn,
  EMPTY_MAILING_DOC,
  fieldsIn,
  isBlankMailing,
  letterFor,
  NOT_CONDITION,
  type MailingDoc,
} from "@/lib/mailings/doc";
import { named } from "@/lib/email-parsing/addresses";
import type {
  BroadcastScheduled,
  WhatsAppTemplate,
  TemplateDeleteResult,
  TemplateRefusal,
  TemplateTaken,
  TemplateUses,
  WrittenBroadcast,
} from "@/lib/broadcasts/drafts.server";
import { staffMemberText } from "@/lib/staff-member";
import type { BroadcastWriterData } from "@/lib/broadcasts/pages.server";
import { filtersPath } from "@/lib/list-params";
import { earliestRun, londonWhen, sendsAt, staffClock, staffDate, staffTime } from "@/lib/staff-time";
import type { Channel } from "@/lib/supporters/contact-permissions";
import {
  approvalProblems,
  rejectionWords,
  fakeRecipient,
  hasField,
  hasWords,
  BROADCAST_START,
  consentChoice,
  textCost,
  sameTemplate,
  sameWords,
  broadcastScheduleProblems,
  BROADCAST_SEND_BY,
  BROADCAST_SENDER,
  sendingDays,
  TEXT_SENDER_NAME,
  type BroadcastScheduleProblem,
  type BroadcastSendBy,
} from "@/lib/broadcasts/broadcasts";
import {
  DraftTitle,
  DueSection,
  ProblemList,
  ScheduleButton,
  TEST_NEEDS,
  TestSent,
  useDraftWriter,
  type DraftActions,
  type SaveRefusal,
} from "../mailings/DraftWriter";
import Alert from "../ui/Alert";
import { useTellPage } from "../ui/ResultForm";
import { ARMED_FOR } from "../ui/DeleteTwice";
import { DeleteDraft } from "../mailings/MailingButtons";
import MailingEditor from "../mailings/MailingEditor";
import ConditionMenu from "../mailings/ConditionMenu";
import {
  inOrder,
  type TextButton,
  type TextHeader,
  type TextPlace,
  type TextVersion,
} from "@/lib/broadcasts/text-parts";
import TextTop, { pictureSource } from "./TextTop";
import { RealMaps } from "./PlaceMap";
import TextButtons from "./TextButtons";
import TextVersions, { type VersionSide } from "./TextVersions";
import MailingFiles from "../mailings/MailingFiles";
import BroadcastConsent from "./BroadcastConsent";
import { othersThanConsent } from "../supporters/SupporterFilters";
import { MailingLetter } from "../mailings/MailingLetter";
import TextBubble, { type TextDoc } from "./TextBubble";
import { firstLink, mapsLink, type LinkCard } from "@/lib/broadcasts/link-card";
import { BandFact, Facts } from "../ui/Band";
import Grid, { Card } from "../ui/Grid";
import NotIcon from "../ui/NotIcon";
import { partButton, partButtonWords } from "../mailings/PartBox";
import Strip from "../ui/Strip";
import { DraftFinish } from "./BroadcastTimes";
import Numbered from "../ui/Numbered";
import IconText from "../ui/IconText";
import { phoneWords } from "@/lib/phone";
import styles from "../mailings/MailingWriter.module.css";
import own from "./Broadcasts.module.css";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

/** What can send an email, in the order they're offered. */
const SEND_BY = Object.keys(BROADCAST_SEND_BY) as BroadcastSendBy[];

/** What a broadcast's page can change. */
type Changes = {
  subject: string;
  body: MailingDoc;
  /** What sends an email. */
  sendBy: BroadcastSendBy;
  dueAt: Date | null;
  /** When it stops trying, in minutes after its time; null for the most (sendingStopsAt). */
  finishMinutes: number | null;
  templateId: number | null;
  /** A text's, which has no subject to be one. */
  title: string;
  /** A text's top, the place its map shows, its reply buttons, and its second version (text-parts.ts). */
  header: TextHeader | null;
  place: TextPlace | null;
  pictureId: string | null;
  buttons: TextButton[];
  textVersion: TextVersion | null;
};

/** How long WhatsApp can take to approve a template: a text due sooner than this, on one it hasn't, is warned of it. */
const APPROVAL_MS = 24 * 60 * 60 * 1000;

/**
 * The broadcast pages' Server Actions (app/(staff)/staff/_components/broadcasts/actions.ts), which the page hands
 * in. Each answers a result (lib/form-result.ts) or redirects; refused as "gone", the draft was deleted, or is no
 * longer one, since the page loaded.
 */
export type BroadcastWriterActions = DraftActions & {
  /** Sends `to` a test copy, filled in for a made-up recipient meeting `meets` (fakeRecipient); says where it went. */
  sendTest: (id: number, meets: string[], to: string) => Promise<FormResult<"gone" | "not-sent", { to: string }>>;
  /** Schedules it; not scheduled as WhatsApp didn't take the new words scheduling sends it, says what WhatsApp said. */
  schedule: (id: number, version: number) => Promise<FormResult<SaveRefusal | TemplateRefusal, BroadcastScheduled>>;
  /** Deletes the draft, and goes to the list of broadcasts. */
  deleteDraft: (form: FormData) => Promise<FormResult<never>>;
  /** Changes the Consent a draft goes under; says the draft's version it made. */
  changeConsent: (id: number, consent: string) => Promise<FormResult<"gone" | "conflict", { version: number }>>;
  /** Makes a draft under a Consent, from New broadcast, and opens it. */
  create: (consent: string) => Promise<FormResult<never>>;
  /** Sends a text's new words to WhatsApp for approval, by the name they're given; says whether it took them. */
  submitTemplate: (id: number) => Promise<FormResult<TemplateRefusal, TemplateTaken>>;
  /** Takes them back, so they can be changed. */
  withdrawTemplate: (id: number) => Promise<FormResult<"gone">>;
  /** Deletes an approved template no broadcast has, from WhatsApp too. */
  deleteTemplate: (templateId: number) => Promise<FormResult<Exclude<TemplateDeleteResult, "deleted">>>;
  /** The card WhatsApp would show at the top of a text for its link to `url`, if any. */
  linkCard: (url: string) => Promise<FormResult<never, { card: LinkCard | null }>>;
  /** The places a Google Maps link or words point at, for a text's map. */
  findPlaces: (input: string) => Promise<FormResult<never, { places: TextPlace[] }>>;
  /** Keeps a picture for a text's top, from a form with its file. */
  uploadPicture: (form: FormData) => Promise<FormResult<"not-picture" | "too-big", { pictureId: string }>>;
};

/**
 * A template's facts as the dropdown gives them (templateOption), on a line
 * under the one chosen, a dot between each, and Unused last if nothing has
 * ever had it; `uses` are its own but for this draft's.
 */
export function templateLine(template: WhatsAppTemplate, uses: TemplateUses = template.uses): string {
  const { tag, facts } = templateOption(template, uses);
  return [...facts!, ...(tag ? [tag] : [])].join(" · ");
}

/**
 * A template in the dropdown: its facts, on a line under its name: who made it; when it was last sent and to how many, or
 * else when it's first scheduled for, or else when it was approved, as being
 * sent or scheduled says it was; and how many other drafts have it (`uses`),
 * if any do; or a tag saying nothing ever has.
 */
export function templateOption(template: WhatsAppTemplate, uses: TemplateUses): Pick<MenuOption, "tag" | "facts"> {
  const facts = copy.templateFacts;
  const by = template.createdBy ? staffMemberText(template.createdBy) : copy.templateMadeIn;
  if (!template.lastUsedAt && uses.sent + uses.scheduled + uses.drafts === 0) {
    return { tag: facts.unused, facts: [by, facts.approved(staffDate(template.approvedAt!))] };
  }
  return {
    facts: [
      by,
      template.lastUsedAt
        ? facts.used(staffDate(template.lastUsedAt), template.lastUsedTo)
        : template.nextScheduledAt
          ? facts.scheduled(staffDate(template.nextScheduledAt))
          : facts.approved(staffDate(template.approvedAt!)),
      ...(uses.drafts ? [facts.drafts(uses.drafts)] : []),
    ],
  };
}

/** A copy of template `name`'s name, numbered after any of `names` that copy it already. */
function copyName(name: string, names: string[]): string {
  let n = 2;
  while (names.includes(copy.copyName(name, n))) n++;
  return copy.copyName(name, n);
}

/** What only new words can have wrong, said under Send for approval. */
const NEW_WORDS_PROBLEMS: BroadcastScheduleProblem[] = [
  "no-name",
  "field-edge",
  "fields-together",
  "field-twice",
  "same-words",
];

/** How a draft's words stand: an email's own, or a text's template chosen, new words, or none yet. */
type Words = "email" | "chosen" | "new" | "none";

/**
 * New words WhatsApp is reviewing: their name and words as they were sent,
 * which can't be changed while it does, and the button that takes them back
 * to change them. Pressed a second time, the button is as it was to begin
 * with once that's done, however it went. If taking them back throws, or
 * never arrives, it says so under the button, in the kit's words.
 */
function TemplatePending({ template, withdraw }: { template: WhatsAppTemplate; withdraw: () => Promise<void> }) {
  const fields = Object.fromEntries(Object.entries(copy.fieldWords));
  const [armed, setArmed] = useState(false);
  const [take, withdrawing, broke] = useSave(async () => {
    try {
      await withdraw();
    } finally {
      setArmed(false);
    }
  });
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARMED_FOR);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <>
      {/* As sent: its name and its words, each under its label, as when they were written. */}
      <div className={styles.letter}>
        <p className={styles.label}>{copy.templateName}</p>
        <p className={own.sentValue}>{template.name}</p>
      </div>
      <div className={styles.letter}>
        <p className={styles.label}>{copy.templateWords}</p>
        <MailingLetter doc={template.body} fields={fields} />
      </div>
      {/* Who asked, and when, as an approved template's line says who made it; always someone, as they're sent from here. */}
      <Muted>{copy.templatePending(staffMemberText(template.createdBy!), staffDate(template.requestedAt))}</Muted>
      <div>
        {/* Pressed twice, as a delete is: the first asks, red, for the second, and turns back unless it comes. */}
        {armed || withdrawing ? (
          <Button
            variant="danger"
            size="small"
            fit
            autoFocus
            pending={withdrawing}
            onBlur={() => setArmed(false)}
            onClick={() => take()}
          >
            {copy.withdrawSure}
          </Button>
        ) : (
          <Button variant="ghost" size="small" fit onClick={() => setArmed(true)}>
            {copy.withdrawTemplate}
          </Button>
        )}
        {broke && <FieldError announce="alert">{staffVocabulary.notDone}</FieldError>}
      </div>
    </>
  );
}

/** How long the words' link must stay the same before its page is asked for its card, so typing it doesn't ask for each letter. */
const CARD_PAUSE_MS = 600;

/**
 * A text's bubble, with the card WhatsApp shows for its first link once its
 * page has said what goes on it; each link asked about once. Under it, a
 * warning when that link is to Google Maps, whose card WhatsApp breaks (mapsLink).
 */
function TextPreview({
  words,
  footer,
  time,
  linkCard,
  place,
  picture,
  buttons,
}: {
  words: TextDoc;
  footer: string;
  time: string;
  linkCard: BroadcastWriterActions["linkCard"];
  /** The place its map shows, or where its picture is, in place of its link's card. */
  place: TextPlace | null;
  picture: string | null;
  buttons: string[];
}) {
  const link = firstLink(words.content);
  const [cards, setCards] = useState<Record<string, LinkCard | null>>({});
  // A link whose page couldn't be asked has no card, as one whose page has nothing to show.
  const [ask] = useSave(linkCard, { done: ({ card }, url) => setCards((known) => ({ ...known, [url]: card })) });
  const askFor = useEffectEvent(ask);
  useEffect(() => {
    if (!link || link in cards) return;
    const timer = setTimeout(() => askFor(link), CARD_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [link, cards]);
  return (
    <>
      <TextBubble
        words={words}
        card={link ? cards[link] : null}
        place={place}
        picture={picture}
        buttons={buttons}
        footer={footer}
        time={time}
      />
      {link && !place && mapsLink(link) && <Alert tone="amber">{copy.mapsFirst}</Alert>}
    </>
  );
}

/**
 * Each recipient's copy, as they'll get it: an email as a mail app shows
 * it, or a text as a bubble. Over it, a button for each field the words use
 * and each condition of their parts, pressed for those who have or meet it,
 * each press choosing a recipient like that. With no one like that, no
 * copy, as there's no one to fill it in for. Under it, for new words,
 * sending them for approval (`approval`), as a test copy can only go once
 * WhatsApp has approved them; then a test copy.
 */
function BroadcastPreview({
  data,
  draft,
  body,
  words,
  subject,
  from,
  gmail,
  needs,
  dueAt,
  sendTest,
  linkCard,
  footer,
  approval,
  top,
  textVersion,
}: {
  data: BroadcastWriterData;
  draft: WrittenBroadcast;
  body: MailingDoc;
  words: Words;
  /** A text's place, if its top is a map, or where its picture is, if it's a picture; and its buttons' words. */
  top: { place: TextPlace | null; picture: string | null; buttons: string[] };
  /**
   * A text's second version, with the same, for those who meet its
   * condition; and whether the made-up recipient does (`met`), as the
   * writer's open tab says, which the toggle for it changes (`onMet`).
   */
  textVersion?: {
    condition: string;
    body: MailingDoc;
    words: Words;
    footer: string;
    place: TextPlace | null;
    picture: string | null;
    buttons: string[];
    met: boolean;
    onMet: (met: boolean) => void;
  } | null;
  /** A text's footer: its chosen template's, as it went to WhatsApp, or for new words, the one they'd go with. */
  footer: string;
  subject: string;
  from: string;
  /** The connected Gmail an email goes from, which its test goes from too; none for Postmark. */
  gmail: string | null;
  /** What it still needs before there's something to test, as the Send section says it. */
  needs: string[];
  dueAt: Date | null;
  /** Sends `to` a test copy for a recipient meeting `meets`; says where it went, or nothing if it didn't go. */
  sendTest: (meets: string[], to: string) => Promise<string | undefined>;
  approval?: ReactNode;
  linkCard: BroadcastWriterActions["linkCard"];
}) {
  const email = draft.channel === "email";
  const testId = useId();
  const findLabel = useId();
  const [testTo, setTestTo] = useState(email ? data.me : "");
  // Each button's answer: unpressed, the made-up recipient lacks that field or condition.
  const [lacks, setLacks] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<{ to?: string } | undefined>();
  // `broke`: sending it threw, or never arrived, which reads as the test copy not having gone.
  const [send, sending, broke] = useSave(sendTest, { done: (to) => setSent({ to }) });
  if (words === "none" && !textVersion) return <p className={styles.noEmail}>{copy.chooseTemplate}</p>;
  const used = [
    ...new Set([
      ...fieldsIn(body).map(hasField),
      ...(textVersion ? [...fieldsIn(textVersion.body).map(hasField), textVersion.condition] : []),
      ...conditionsIn(body).map((c) => (c.startsWith(NOT_CONDITION) ? c.slice(NOT_CONDITION.length) : c)),
    ]),
  ];
  // The second version's condition is met as the writer's open tab says.
  const meets = Object.fromEntries(used.map((c) => [c, c === textVersion?.condition ? textVersion.met : !lacks[c]]));
  // The version the made-up recipient gets: the second one, if they meet its condition.
  const theirs = textVersion?.met ? textVersion : { body, words, footer, ...top };
  const met = used.filter((c) => meets[c]);
  const recipient = fakeRecipient(met, draft.channel);
  // Of the one made-up recipient, so "have a first name"; a part's own words where a condition has none here.
  const labels: Record<string, string> = {
    ...Object.fromEntries(data.conditions.map((condition) => [condition.id, condition.label])),
    ...copy.previewCases,
  };
  const toggle = (condition: string) => {
    if (condition === textVersion?.condition) textVersion.onMet(!textVersion.met);
    else setLacks({ ...lacks, [condition]: meets[condition] });
    setSent(undefined);
  };
  const canTest =
    needs.length === 0 &&
    (email ? looksLikeEmail(testTo.trim()) : theirs.words === "chosen" && data.sends && testTo.trim());
  const testNote = email
    ? gmail
      ? copy.testVia.emailGmail(gmail)
      : copy.testVia.email(BROADCAST_SENDER.email)
    : !data.sends || !data.textNumber
      ? copy.testVia.textOff
      : theirs.words === "chosen"
        ? copy.testVia.text(phoneWords(data.textNumber))
        : copy.testVia.textNew;
  // How the last test copy went: one whose send broke didn't go, whatever the one before it did.
  const testLine = broke ? copy.testFailed : sent && (sent.to ? copy.testSent(sent.to) : copy.testFailed);
  return (
    <>
      {used.length > 0 && (
        <div className={styles.find}>
          <p id={findLabel} className={styles.label}>
            {copy.findRecipient}
          </p>
          <ul className={styles.toggles} aria-labelledby={findLabel}>
            {used.map((condition) => (
              <li key={condition}>
                <button
                  type="button"
                  aria-pressed={meets[condition]}
                  className={partButton(!meets[condition])}
                  onClick={() => toggle(condition)}
                >
                  {!meets[condition] && <NotIcon />}
                  <span className={partButtonWords}>{labels[condition] ?? condition}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {email ? (
        <div className={styles.email}>
          <dl className={styles.headers}>
            <dt>{copy.headers.from}</dt>
            <dd>{from}</dd>
            <dt>{copy.headers.to}</dt>
            <dd>{`${recipient.name} <${recipient.address}>`}</dd>
            <dt>{copy.subject}</dt>
            <dd>
              <strong>{subject}</strong>
            </dd>
          </dl>
          <MailingLetter doc={letterFor(body, recipient)} />
        </div>
      ) : (
        <TextPreview
          words={letterFor(theirs.body, recipient)}
          footer={theirs.footer}
          time={staffClock(sendsAt(dueAt ?? earliestRun()))}
          linkCard={linkCard}
          place={theirs.place}
          picture={theirs.picture}
          buttons={theirs.buttons}
        />
      )}
      {approval}

      <div className={styles.test}>
        <div className={styles.testRow}>
          <label htmlFor={testId} className={styles.testLabel}>
            {copy.testTo}
          </label>
          <span className={styles.testTo}>
            <TextInput
              id={testId}
              type={email ? "email" : "tel"}
              value={testTo}
              onChange={(event) => setTestTo(event.target.value)}
            />
          </span>
          <Button variant="primary" fit disabled={!canTest} pending={sending} onClick={() => send(met, testTo.trim())}>
            {copy.sendTest}
          </Button>
        </div>
        <Muted>{testNote}</Muted>
        <TestSent line={testLine} sent={!broke && Boolean(sent?.to)} />
        <ProblemList problems={needs} />
      </div>
    </>
  );
}

/**
 * A draft broadcast to supporters, by email or text, on one page, in six
 * numbered sections: who it's to, what they said yes to apart from the
 * other filters' pills, with Change who, and who's left out; writing it, an email's subject, words and files, or a text's template;
 * a preview of each recipient's copy; who it appears from; when it goes,
 * and for a text when it stops; and what will go and cost, with the button to
 * schedule it, greyed with the reasons while anything stops it.
 */
export default function BroadcastWriter({
  data,
  draft,
  who,
  blank = false,
  creating = false,
  chosen,
  onChannel,
  actions,
}: {
  data: BroadcastWriterData;
  draft: WrittenBroadcast;
  /** Who else it's to, as pills (BroadcastWho). */
  who: ReactNode;
  /** Before a Consent by the channel picked is chosen: everything but the Consent greyed and still (ChannelWriter). */
  blank?: boolean;
  /** New broadcast, with no draft yet: choosing its Consent makes one. */
  creating?: boolean;
  /** The channel picked, and what's told when another is (ChannelWriter). */
  chosen?: Channel | "";
  onChannel?: (channel: Channel) => void;
  actions: BroadcastWriterActions;
}) {
  const router = useRouter();
  const label = useId();
  const email = draft.channel === "email";
  const { id } = draft;
  const start = BROADCAST_START;
  const tell = useTellPage();
  // The channel whose Consents show: the draft's, or on New broadcast the one picked, if any.
  const [shown, setShown] = useState<Channel | "">(chosen ?? (email ? "email" : "phone"));
  const show = (channel: Channel) => {
    setShown(channel);
    onChannel?.(channel);
  };
  // An email with nothing written yet starts with a greeting and a signature, saved with its first change.
  const [fresh] = useState<Partial<Changes>>(() =>
    email && !draft.subject && isBlankMailing(draft.body) ? { body: start } : {},
  );
  const {
    values,
    change,
    saveNow,
    alongside,
    saveState,
    version,
    attachments,
    attach,
    detach,
    fileProblem,
    stale,
    conflicted,
    restored,
  } = useDraftWriter<Changes>({
    id,
    version: draft.version,
    initial: {
      subject: draft.subject,
      body: draft.body,
      sendBy: draft.sendBy,
      dueAt: draft.dueAt,
      finishMinutes: draft.finishMinutes,
      templateId: draft.template?.status === "approved" ? draft.template.id : null,
      title: draft.title,
      header: draft.header,
      place: draft.place,
      pictureId: draft.pictureId,
      buttons: draft.buttons,
      textVersion: draft.textVersion && {
        condition: draft.textVersion.condition,
        body: draft.textVersion.body,
        templateId: draft.textVersion.templateId,
        header: draft.textVersion.header,
        place: draft.textVersion.place,
        pictureId: draft.textVersion.pictureId,
        buttons: draft.textVersion.buttons,
      },
    },
    fresh,
    attachments: draft.attachments,
    actions,
  });
  /**
   * What one of the writer's actions answers; nothing from one the site no
   * longer has, which leaves the draft outdated, as the page says over it
   * (`stale`).
   */
  const unlessStale = <Answer,>(answer: Promise<Answer>): Promise<Answer | undefined> =>
    answer.catch((error: unknown) => {
      if (stale(error)) return undefined;
      throw error;
    });
  // The places a link or words point at, for a text's map: none on a page gone out of date, which says so over the draft.
  const findPlaces = async (input: string) => (await unlessStale(actions.findPlaces(input)))?.places ?? [];
  // A picture kept for a text's top: its ID, or why it can't be one; nothing on a page gone out of date.
  const uploadPicture = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    const kept = await unlessStale(actions.uploadPicture(form));
    return kept && (kept.ok ? { pictureId: kept.pictureId } : { refused: kept.reason });
  };
  // Choosing a Consent: on New broadcast, makes the draft; on a draft, changes it, what's typed saved either side
  // of the change (alongside). The change brings the page back with its new counts (revalidatePath): it's under
  // way (`calculating`) till they're here. Till then the one picked shows as chosen, and what goes by the counts
  // waits. One that isn't made goes back to the draft's own: for a draft that's gone, or no longer one, the top of
  // the page says so, as its page takes this one's place; for one with words from elsewhere, the draft says it
  // changed elsewhere, as a save refused for that does; and if the change broke, it says so under the lists.
  const [picked, pickConsent, calculating, consentBroke] = useSavedChoice(
    undefined as string | undefined,
    async (consent: string) => {
      if (creating) {
        await actions.create(consent);
        return;
      }
      await alongside(async () => {
        const result = await actions.changeConsent(id, consent);
        if (result.ok) return result.version;
        if (result.reason === "gone") tell(copy.refusals.draft.gone);
        else conflicted();
        return false;
      });
    },
    (consent) => consent,
  );
  const [choosing, choose] = useLeaving();
  // Another choice of what sends it is saved at once, so the page has what the new choice can send.
  const [saveSendBy] = useSave(async () => {
    await saveNow();
    router.refresh();
  });
  // New words WhatsApp has taken for approval: the button stays pending till the page is back with them waiting.
  const [submitted, setSubmitted] = useState(false);
  // Why the words didn't go for approval just now, so they're still here to send again: an alert under the button.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submit, submitting, submitBroke] = useSave(
    async () => {
      await saveNow();
      return unlessStale(actions.submitTemplate(id));
    },
    {
      done: (result) => {
        // An outdated page says so over the draft, not here.
        if (!result) return;
        if (!result.ok) return setSubmitError(copy.submitRefused[result.reason]);
        if (!result.taken) return setSubmitError(copy.submitFailed(result.said));
        // It stays on the draft, brought back as sent, its top in view, where a strip says it's waiting for WhatsApp.
        setSubmitted(true);
        router.refresh();
        window.scrollTo({ top: 0, behavior: "instant" });
      },
    },
  );
  // Why Schedule didn't just now, where the draft doesn't say it elsewhere: an alert under the button.
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  // New words sent to WhatsApp, waiting for it to approve them.
  const waiting = draft.template?.status === "pending" ? draft.template : undefined;
  // Once taken back, the words can be changed again: Write is brought fully into view once the page has them.
  const withdrew = useRef(false);
  const writeCard = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!withdrew.current) return;
    withdrew.current = false;
    writeCard.current!.scrollIntoView({ block: "start", behavior: "instant" });
  }, [waiting]);
  // A text's words: an approved template's, or new ones, a tab each. New words
  // are kept while the other tab is open, so going back finds them.
  const [writingNew, setWritingNew] = useState(
    () => !email && !isBlankMailing(draft.body) && draft.template?.status !== "approved",
  );
  const newWords = useRef<MailingDoc>(EMPTY_MAILING_DOC);
  const newName = useRef("");
  const wordsLabel = useId();
  const picker = useId();
  // Why the template chosen wasn't deleted just now: an alert under it.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const body = useMemo(() => checkMailingDoc(values.body) ?? EMPTY_MAILING_DOC, [values.body]);
  const template = data.templates.find((one) => one.id === values.templateId);
  const words: Words = email ? "email" : writingNew ? "new" : template ? "chosen" : "none";
  const written = email
    ? !isBlankMailing(body) && JSON.stringify(body) !== JSON.stringify(start)
    : !isBlankMailing(body);
  // By Gmail, it goes from the address's own connected Gmail, which sends so many a day.
  const byGmail = email && values.sendBy === "gmail";
  // Whether the page has the Gmail's state yet: just after it's chosen, the page is still the one for Postmark, which
  // has no Gmail to check, till it comes back.
  const gmailChecked = byGmail && data.sender.byGmail;
  // How many more emails or texts can go today, and each day after, and so how many days this takes.
  const { remaining, daily } = data.sender;
  const days = sendingDays(data.count, remaining, daily);
  // A text's second version, and which of its two is open.
  const textVersion = email ? null : values.textVersion;
  const [side, setSide] = useState<VersionSide>("only");
  // Made anew when its words are put in from the second version, as an editor reads its words once.
  const [ownKey, setOwnKey] = useState(0);
  const versionLabel = useId();
  const condition = textVersion && data.conditions.find((one) => one.id === textVersion.condition);
  const versionWho = condition?.label ?? textVersion?.condition ?? "";
  const versionCovers = condition?.covers ?? 0;
  // The second version's words are WhatsApp's to review: they can't change till it decides.
  const versionLocked = draft.textVersion?.template?.status === "pending";
  const ownParts = { body, header: values.header, buttons: values.buttons };
  const templateCount = textVersion && !sameTemplate(textVersion, ownParts) ? 2 : 1;
  // How many templates Send for approval sends: new words of its own, and a second version that's neither the same
  // template nor one WhatsApp has (submitTemplate).
  const versionHas =
    textVersion !== null &&
    textVersion.templateId !== null &&
    textVersion.templateId === draft.textVersion?.templateId &&
    ["pending", "approved"].includes(draft.textVersion.template?.status ?? "");
  const toSubmit =
    (writingNew && !waiting ? 1 : 0) + (textVersion && !versionHas && !sameTemplate(textVersion, ownParts) ? 1 : 0);
  const setVersion = (patch: Partial<TextVersion>) => change({ textVersion: { ...textVersion!, ...patch } });
  // A second version for those who meet `chosen`: a copy of the text as it is, open to change.
  const addVersion = (chosen: string) => {
    change({
      textVersion: {
        condition: chosen,
        body,
        templateId: null,
        header: values.header,
        place: values.place,
        pictureId: values.pictureId,
        buttons: values.buttons,
      },
    });
    setSide("only");
  };
  // The open version's ×: it's the text for everyone, the other gone.
  const keepOpen = () => {
    if (side === "except") return change({ textVersion: null });
    const { body: kept, header, place, pictureId, buttons } = textVersion!;
    change({ templateId: null, body: kept, header, place, pictureId, buttons, textVersion: null });
    setWritingNew(true);
    setOwnKey((n) => n + 1);
  };
  // A picture pasted anywhere in Write, words and all, is the open version's top, as words can't hold one; but not
  // where its top is a chosen template's other kind, or WhatsApp is reviewing it.
  const pastePicture = (event: React.ClipboardEvent) => {
    const file = [...event.clipboardData.files].find((one) => one.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    const version = textVersion && side === "only";
    if (version ? versionLocked : (!writingNew || waiting) && values.header !== "image") return;
    void uploadPicture(file).then((kept) => {
      if (!kept || "refused" in kept) return;
      if (version) setVersion({ header: "image", pictureId: kept.pictureId, templateId: null });
      else change({ header: "image", pictureId: kept.pictureId });
    });
  };
  // Beside the words, where an email has its parts: a second version for some, and nothing once it has one, as a
  // text has one at most.
  const textParts = !textVersion && (
    <ConditionMenu not={false} conditions={data.conditions} recipients={data.count} choose={addVersion} />
  );
  const problems = broadcastScheduleProblems({
    channel: draft.channel,
    subject: values.subject,
    title: values.title,
    body: written ? body : EMPTY_MAILING_DOC,
    dueAt: values.dueAt,
    finishMinutes: values.finishMinutes,
    recipients: data.count,
    unknown: data.unknown,
    byGmail: gmailChecked,
    connected: data.sender.connected,
    remaining,
    daily,
    approved: words === "chosen",
    sameWords: sameWords(
      body,
      data.templates.map((template) => template.body),
    ),
    numbered: Boolean(data.textNumber),
    sends: data.sends,
    header: values.header,
    place: values.place,
    pictureId: values.pictureId,
    buttons: values.buttons,
    textVersion: textVersion && {
      ...textVersion,
      approved: versionHas && draft.textVersion!.template!.status === "approved",
      sameWords: sameWords(
        textVersion.body,
        data.templates.map((one) => one.body),
      ),
    },
  }).filter((problem) => problem !== "cannot-send");
  // Greyed, before a Consent by the channel picked: that comes first, till one's picked. What only new words have
  // wrong is said under Send for approval, not again by Schedule.
  const shownProblems = [...(blank && !picked ? ["no-consent"] : []), ...problems].filter(
    (problem) => !(NEW_WORDS_PROBLEMS as string[]).includes(problem),
  );
  const fromName = email ? draft.fromName || BROADCAST_SENDER.name : TEXT_SENDER_NAME;
  const fromLine = email ? named(fromName, draft.sentFrom!) : TEXT_SENDER_NAME;
  // In Send, as the broadcast's page has it: the address, or a text's WhatsApp number once there is one, the
  // name under it; with no number yet, the name alone.
  const fromAddress = email ? draft.sentFrom! : data.textNumber && phoneWords(data.textNumber);
  const title = email ? values.subject.trim() || copy.newTitle.email : values.title.trim() || copy.newTitle.text;
  const whoPath = filtersPath("/staff/supporters", { ...data.filter.params, broadcast: String(id) });
  // To the list, to change who: what's typed is saved first, so going there loses none of it.
  const [toList] = useSave(async () => {
    await saveNow();
    leavePage(whoPath);
  });
  const hasOwnWords = hasWords({ subject: values.subject, body, templateId: values.templateId });
  // Before a Consent by the channel picked, what's still to come: there, but greyed and out of reach.
  const lockable = (children: ReactNode) =>
    blank ? (
      <div inert className={own.locked}>
        {children}
      </div>
    ) : (
      children
    );
  // Choosing a template takes its words, name, top and buttons; new words, and their name, are kept while one is
  // chosen.
  const chooseWords = (value: string) => {
    if (value === "new") {
      change({ templateId: null, body: newWords.current, title: newName.current });
      setWritingNew(true);
      return;
    }
    const one = data.templates.find((t) => t.id === Number(value))!;
    if (writingNew) {
      newWords.current = body;
      newName.current = values.title;
    }
    change({ templateId: one.id, body: one.body, title: one.name, header: one.header, buttons: one.buttons });
    setWritingNew(false);
  };
  // As the page has them, this draft has its template saved: how many others have each.
  const others = (one: WhatsAppTemplate): TemplateUses =>
    draft.template?.id === one.id ? { ...one.uses, drafts: one.uses.drafts - 1 } : one.uses;
  const unused = (one: WhatsAppTemplate) => Object.values(others(one)).every((n) => n === 0);
  // Edit as a new template: its words, under a new name, are new words, to change and send for approval.
  const editTemplate = (one: WhatsAppTemplate) => {
    newWords.current = one.body;
    newName.current = copyName(
      one.name,
      data.templates.map((t) => t.name),
    );
    chooseWords("new");
  };
  // Deleting the template chosen: this draft lets it go first, so nothing has it, and chooses again after. Letting
  // it go takes its line away, and its button with it, so why it wasn't deleted is said under the dropdown.
  const deleteChosen = async (one: WhatsAppTemplate): Promise<FormResult<never>> => {
    setDeleteError(null);
    change({ templateId: null, body: EMPTY_MAILING_DOC, title: "" });
    await saveNow();
    try {
      // An outdated page says so over the draft, not here.
      const result = await unlessStale(actions.deleteTemplate(one.id));
      if (result && !result.ok) setDeleteError(copy.deleteRefused[result.reason]);
    } catch (error) {
      // Thrown on, for the button's form to tell the site of it (useFormResult).
      setDeleteError(copy.deleteRefused.failed);
      throw error;
    } finally {
      router.refresh();
    }
    return { ok: true };
  };
  // Schedule: whether it's scheduled. Not scheduled, why: a draft that's gone, or no longer one, at the top of the
  // page, as its page takes this one's place; one changed elsewhere as a save refused for that says it; and the
  // rest under the button, as under Send for approval, with what WhatsApp said if it didn't take the new words.
  const schedule = async () => {
    setScheduleError(null);
    const result = await actions.schedule(id, version.current);
    if (!result.ok) {
      if (result.reason === "gone" || result.reason === "not-draft") tell(copy.refusals.draft.gone);
      else if (result.reason === "conflict") conflicted();
      else setScheduleError(copy.submitRefused[result.reason]);
    } else if (!result.scheduled) setScheduleError(copy.submitFailed(result.said));
    return { ok: result.ok && result.scheduled };
  };
  const wordsEditor = (labelledBy: string) => (
    // Made anew with what a reload kept, as it reads its words once.
    <MailingEditor
      key={`${restored}-${ownKey}`}
      initial={values.body as JSONContent}
      onChange={(doc) => change({ body: doc as MailingDoc })}
      fields={data.fields}
      conditions={data.conditions}
      whatsApp={!email}
      textParts={email ? undefined : textParts}
      recipients={data.count}
      labelledBy={labelledBy}
    />
  );
  // A version of a text: its top, words and buttons. Its own (`except`) has its words only as new words, as a chosen
  // template's are in the preview; its top and buttons are a chosen template's, but its place is its own.
  const versionParts = (open: VersionSide) => {
    if (open === "only") {
      const version = textVersion!;
      const rejected = draft.textVersion?.template?.status === "rejected" ? draft.textVersion.template : null;
      return (
        <div className={`${own.textWords} ${own.versionWords}`}>
          {/* WhatsApp rejected its words: why, till they're sent again. */}
          {rejected && version.templateId === rejected.id && (
            <Strip tone="red">{copy.rejected(rejectionWords(rejected.rejectedReason))}</Strip>
          )}
          <TextTop
            header={version.header}
            place={version.place}
            pictureId={version.pictureId}
            link={firstLink(version.body.content)}
            onChange={(top) => setVersion({ ...top, ...("header" in top && { templateId: null }) })}
            findPlaces={findPlaces}
            uploadPicture={uploadPicture}
            fixed={versionLocked}
          />
          <div className={styles.letter}>
            <p id={versionLabel} className={styles.label}>
              {copy.templateWords}
            </p>
            {versionLocked ? (
              <MailingLetter doc={version.body} />
            ) : (
              <MailingEditor
                key={`${restored}-${version.condition}`}
                initial={version.body as JSONContent}
                onChange={(doc) => setVersion({ body: doc as MailingDoc, templateId: null })}
                fields={data.fields}
                conditions={data.conditions}
                whatsApp
                textParts={textParts}
                recipients={data.count}
                labelledBy={versionLabel}
              />
            )}
          </div>
          <TextButtons
            buttons={version.buttons}
            onChange={(buttons) => setVersion({ buttons, templateId: null })}
            fixed={versionLocked}
          />
        </div>
      );
    }
    const fixed = !writingNew || Boolean(waiting);
    return (
      <div className={own.textWords}>
        <TextTop
          header={values.header}
          place={values.place}
          pictureId={values.pictureId}
          link={firstLink(body.content)}
          onChange={(top) => change(top)}
          findPlaces={findPlaces}
          uploadPicture={uploadPicture}
          fixed={fixed}
        />
        {writingNew && !waiting && (
          <div className={styles.letter}>
            <p id={wordsLabel} className={styles.label}>
              {copy.templateWords}
            </p>
            {wordsEditor(wordsLabel)}
            <Hint>{copy.newTemplateHint}</Hint>
          </div>
        )}
        <TextButtons buttons={values.buttons} onChange={(buttons) => change({ buttons })} fixed={fixed} />
      </div>
    );
  };
  return (
    <RealMaps value={data.realMaps}>
      {/* While a Consent's change is under way, that in place of whether it's saved; what's not a draft yet has neither. */}
      <DraftTitle title={title} saveState={calculating ? "calculating" : blank ? undefined : saveState} />
      {saveState === "conflict" && (
        <Strip tone="red" announce>
          {mailingsCopy.mailingPages.saveStates.conflict}
        </Strip>
      )}
      {draft.template?.status === "pending" && (
        <Strip tone="blue" waiting>
          {copy.awaitingApproval(staffMemberText(draft.template.createdBy!), staffTime(draft.template.requestedAt))}
        </Strip>
      )}
      {draft.template?.status === "rejected" && (
        <Strip tone="red">{copy.rejected(rejectionWords(draft.template.rejectedReason))}</Strip>
      )}
      <Grid>
        <Card span={6} title={<Numbered n={1}>{copy.sections.who}</Numbered>} id="who-title">
          <BroadcastConsent
            value={picked ?? (blank ? "" : consentChoice(draft))}
            channel={draft.channel === "email" ? "email" : "phone"}
            written={hasOwnWords}
            pending={calculating}
            pick={pickConsent}
            shown={shown}
            show={show}
            className={own.consent}
          />
          {consentBroke && <FieldError announce="alert">{staffVocabulary.notDone}</FieldError>}
          {lockable(
            <>
              <div className={styles.who}>
                {who}
                <ButtonAnchor
                  variant="primary"
                  size="small"
                  fit
                  href={whoPath}
                  pending={choosing}
                  onClick={(event) => {
                    event.preventDefault();
                    choose();
                    toList();
                  }}
                >
                  {othersThanConsent(data.filter.params, data.choices).length > 0
                    ? mailingsCopy.mailingPages.changeWho
                    : copy.narrowDown}
                </ButtonAnchor>
              </div>
              {data.unknown.length > 0 && (
                <Strip tone="amber">{mailingsCopy.mailingPages.unknownFilter(data.unknown.join(", "))}</Strip>
              )}
              {/* With no list chosen, it's to no one yet. While who it's to is worked out, a spinner, not the count
                  from before, which would mislead. */}
              {!blank && (
                <p className={styles.count} aria-busy={calculating || undefined}>
                  {calculating ? (
                    <span className={own.counting}>
                      <IconText icon={<span className={own.spinner} aria-hidden="true" />}>{copy.counting}</IconText>
                    </span>
                  ) : (
                    copy.willGet(data.count, draft.channel)
                  )}
                </p>
              )}
            </>,
          )}
        </Card>

        {lockable(
          <>
            <Card span={6} title={<Numbered n={2}>{copy.sections.from}</Numbered>} id="from-title">
              {email ? (
                <div className={styles.from}>
                  <div className={styles.fromFields}>
                    {/* Always the one address, where replies come back to be read: the choice is what sends from it. */}
                    <Field label={copy.fromAccount} className={own.accountChoice}>
                      <Select
                        value={values.sendBy}
                        onChange={(event) => {
                          change({ sendBy: event.target.value as BroadcastSendBy });
                          saveSendBy();
                        }}
                      >
                        {SEND_BY.map((one) => (
                          <option key={one} value={one} disabled={!BROADCAST_SEND_BY[one].available}>
                            {mailingsCopy.mailingPages.fromOption(
                              draft.sentFrom!,
                              mailingsCopy.mailingPages.sendBy.names[one],
                            )}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {/* The name it's from is fixed too. */}
                    <div className={styles.sender}>
                      <p className={styles.label}>{copy.fromName}</p>
                      <p className={own.fixed}>{fromName}</p>
                    </div>
                  </div>
                  {/* By Gmail: how many more its account can send today, and so how long this takes; or that it isn't
                      connected, once the page has checked. By Postmark: that it has no limit. */}
                  {byGmail ? (
                    !gmailChecked ? null : data.sender.connected ? (
                      <Muted>{copy.sendBy.room(draft.sentFrom!, remaining!, days)}</Muted>
                    ) : (
                      <Strip tone="amber">{copy.sendBy.notConnected(draft.sentFrom!)}</Strip>
                    )
                  ) : (
                    <Muted>{copy.sendBy.postmark}</Muted>
                  )}
                </div>
              ) : (
                <div className={own.account}>
                  {/* Our profile picture on WhatsApp: PauseAI's pause symbol, as Global's and every group's is. */}
                  <Image src="/images/logos/Pause-Symbol.svg" alt="" width={616} height={616} className={own.picture} />

                  <p>
                    <strong>{TEXT_SENDER_NAME}</strong>{" "}
                    <Muted>
                      {data.textNumber ? (
                        <span className={own.number}>
                          {mailingsCopy.mailingPages.fromOption(phoneWords(data.textNumber), copy.textBy)}
                        </span>
                      ) : (
                        copy.noNumber
                      )}
                    </Muted>
                  </p>
                </div>
              )}
              {/* A text: how many more people our number can text today, and so how long this takes. */}
              {!email && data.textNumber && <Muted>{copy.textRoom(remaining, days)}</Muted>}
            </Card>

            <Card
              span={6}
              title={<Numbered n={3}>{copy.sections.write}</Numbered>}
              id="write-title"
              className={own.write}
              ref={(element) => {
                writeCard.current = element;
              }}
            >
              {email && (
                <Field label={copy.subject}>
                  <TextInput value={values.subject} onChange={(event) => change({ subject: event.target.value })} />
                </Field>
              )}
              {words === "email" && (
                <div className={styles.letter}>
                  <p id={label} className={styles.label}>
                    {copy.emailLabel}
                  </p>
                  {wordsEditor(label)}
                </div>
              )}
              {!email && (
                <div className={own.textWords} onPasteCapture={pastePicture}>
                  {/* An approved template, or new words, the last choice; while WhatsApp reviews new words, they stay chosen. */}
                  {/* Each approved template with who made it, when, and how much it's used, then new words. */}
                  <div className={styles.sender}>
                    <MenuSelect
                      id={picker}
                      label={copy.templateLabel}
                      placeholder={copy.pickTemplate}
                      value={writingNew ? "new" : template ? String(template.id) : ""}
                      disabled={Boolean(waiting)}
                      options={data.templates.map((one) => ({
                        value: String(one.id),
                        label: one.name,
                        ...templateOption(one, others(one)),
                      }))}
                      last={{ value: "new", label: copy.newTemplate }}
                      onChange={chooseWords}
                    />
                  </div>
                  {/* Its words show once, in the preview; here, its facts as the dropdown gives them (templateLine);
                      then, quietly, its words as a new template, and deleting it while nothing else has it. */}
                  {template && (
                    <div className={own.templateFacts}>
                      <Muted>{templateLine(template, others(template))}</Muted>
                      <div className={own.templateActions}>
                        <Button variant="ghost" size="small" fit onClick={() => editTemplate(template)}>
                          {copy.editTemplate}
                        </Button>
                        {unused(template) && (
                          <DeleteTwice
                            name="template"
                            value={String(template.id)}
                            label={copy.deleteTemplate}
                            short
                            action={() => deleteChosen(template)}
                            says={{}}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {deleteError && <Alert>{deleteError}</Alert>}
                  {writingNew && waiting && (
                    <TemplatePending
                      template={waiting}
                      withdraw={async () => {
                        const result = await unlessStale(actions.withdrawTemplate(id));
                        // An outdated page says so over the draft, not here.
                        if (!result) return;
                        // They wait for WhatsApp no longer, so Send for approval, once it's back, waits for nothing.
                        setSubmitted(false);
                        // With none waiting to take back, the page is back as the template stands, and its top says so.
                        if (!result.ok) return tell(copy.refusals.withdraw.gone);
                        withdrew.current = true;
                        router.refresh();
                      }}
                    />
                  )}
                  {/* What they're called in the list of templates, once approved, and what the broadcast is. */}
                  {writingNew && !waiting && (
                    <Field label={copy.templateName} className={styles.sender}>
                      <TextInput value={values.title} onChange={(event) => change({ title: event.target.value })} />
                    </Field>
                  )}
                  {/* With a chosen template's words, there's no editor to have the parts beside it. */}
                  {!writingNew && template && !textVersion && <div className={own.textParts}>{textParts}</div>}
                  {textVersion ? (
                    <TextVersions
                      who={versionWho}
                      counts={{ only: versionCovers, except: data.count - versionCovers }}
                      open={side}
                      onOpen={setSide}
                      templates={templateCount}
                      onForEveryone={versionLocked ? undefined : keepOpen}
                    >
                      {versionParts(side)}
                    </TextVersions>
                  ) : (
                    (words !== "none" || writingNew) && versionParts("except")
                  )}
                </div>
              )}
              {email && (
                <div>
                  <p className={styles.label}>{copy.files}</p>
                  <MailingFiles
                    files={attachments}
                    base={`/staff/broadcasts/${id}/files`}
                    onAdd={attach}
                    onRemove={detach}
                    problem={fileProblem}
                  />
                </div>
              )}
            </Card>

            <Card
              span={6}
              title={<Numbered n={4}>{words === "new" && !waiting ? copy.previewNew : copy.sections.preview}</Numbered>}
              id="preview-title"
            >
              <BroadcastPreview
                data={data}
                draft={draft}
                body={body}
                words={words}
                footer={template?.footer ?? TEMPLATE_FOOTER}
                top={{
                  place: values.header === "location" ? values.place : null,
                  picture: values.header === "image" && values.pictureId ? pictureSource(values.pictureId) : null,
                  buttons: inOrder(values.buttons).map((button) => button.text),
                }}
                textVersion={
                  textVersion && {
                    condition: textVersion.condition,
                    body: textVersion.body,
                    words: versionHas && draft.textVersion!.template!.status === "approved" ? "chosen" : "new",
                    footer: draft.textVersion?.template?.footer ?? TEMPLATE_FOOTER,
                    place: textVersion.header === "location" ? textVersion.place : null,
                    picture:
                      textVersion.header === "image" && textVersion.pictureId
                        ? pictureSource(textVersion.pictureId)
                        : null,
                    buttons: inOrder(textVersion.buttons).map((button) => button.text),
                    met: side === "only",
                    onMet: (met) => setSide(met ? "only" : "except"),
                  }
                }
                approval={
                  // New words go to WhatsApp from here, under how they'll look, once they're written, before a test,
                  // which can only go once WhatsApp approves them.
                  toSubmit > 0 &&
                  !versionLocked && (
                    <div className={own.approval}>
                      <Button
                        variant="primary"
                        fit
                        disabled={!written || approvalProblems(problems).length > 0 || !data.sends}
                        pending={submitting || submitted}
                        onClick={() => {
                          setSubmitError(null);
                          submit();
                        }}
                      >
                        {toSubmit === 1 ? copy.submitTemplate : copy.textVersions.submit(toSubmit)}
                      </Button>
                      {/* Why it can't go yet, under the button: fields where WhatsApp won't take them, the words
                          a template has already, and the rest. */}
                      <ProblemList problems={approvalProblems(problems).map((problem) => copy.problems[problem])} />
                      {/* Why it didn't go: sending it broke, or what the site or WhatsApp said of it. */}
                      {(submitBroke || submitError) && <Alert>{submitBroke ? copy.submitBroke : submitError}</Alert>}
                    </div>
                  )
                }
                subject={values.subject}
                from={fromLine}
                gmail={gmailChecked && data.sender.connected ? draft.sentFrom : null}
                needs={problems
                  .filter((problem) => TEST_NEEDS.includes(problem))
                  .map((problem) => copy.problems[problem])}
                dueAt={values.dueAt}
                linkCard={actions.linkCard}
                sendTest={async (meets, to) => {
                  // The test is of the draft as saved, so what's typed goes first.
                  await saveNow();
                  const result = await unlessStale(actions.sendTest(id, meets, to));
                  if (result?.ok) return result.to;
                  // A draft that's gone has its page's top say so, as that page takes this one's place.
                  if (result?.reason === "gone") tell(copy.refusals.draft.gone);
                  return undefined;
                }}
              />
            </Card>

            <Card span={6} title={<Numbered n={5}>{copy.sections.when}</Numbered>} id="when-title">
              <DueSection dueAt={values.dueAt} onChange={(dueAt) => change({ dueAt })} />
              {/* Once it has a time: when it stops trying, which moves with it. */}
              {values.dueAt && (
                <DraftFinish
                  dueAt={values.dueAt}
                  finishMinutes={values.finishMinutes}
                  onChange={(finishMinutes) => change({ finishMinutes })}
                />
              )}
              {/* A text WhatsApp hasn't approved, due sooner than it may take to. */}
              {!email &&
                words === "new" &&
                values.dueAt &&
                new Date(values.dueAt).getTime() - now().getTime() < APPROVAL_MS && (
                  <Strip tone="amber">{copy.approvalSoon}</Strip>
                )}
            </Card>

            <Card span={6} title={<Numbered n={6}>{copy.sections.send}</Numbered>} id="send-title">
              <Facts>
                <BandFact label={mailingsCopy.mailingPages.sendFacts.what}>
                  {mailingsCopy.mailingPages.sendFacts.count(data.count, draft.channel)}
                </BandFact>
                <BandFact label={mailingsCopy.mailingPages.sendFacts.from} detail={fromAddress ? fromName : undefined}>
                  {fromAddress || fromName}
                </BandFact>
                <BandFact label={mailingsCopy.mailingPages.sendFacts.via}>
                  {email
                    ? mailingsCopy.mailingPages.sendBy.names[values.sendBy]
                    : mailingsCopy.mailingPages.sendFacts.whatsApp}
                </BandFact>
                <BandFact label={mailingsCopy.mailingPages.sendFacts.when}>
                  {values.dueAt ? londonWhen(values.dueAt, "short") : mailingsCopy.mailingPages.sendFacts.noTime}
                </BandFact>
                {!email && (
                  <BandFact label={mailingsCopy.mailingPages.sendFacts.cost} detail={textCost(data.count).rate}>
                    {textCost(data.count).about}
                  </BandFact>
                )}
              </Facts>
              <div className={styles.send}>
                <ScheduleButton
                  label={copy.schedule(data.count, draft.channel)}
                  disabled={problems.length > 0 || !data.sends || calculating}
                  saveNow={saveNow}
                  schedule={schedule}
                  stale={stale}
                />
                <DeleteDraft id={id} action={actions.deleteDraft} says={{}} />
              </div>
              {scheduleError && <Alert>{scheduleError}</Alert>}
              {/* Then, a bullet as they are but in the words' own colour, that new words go to WhatsApp for approval as
                  it's scheduled, unless they're with it already. */}
              <ProblemList
                problems={shownProblems.map((problem) => copy.problems[problem])}
                notes={words === "new" && !waiting ? [copy.schedulesForApproval(templateCount)] : []}
              />
            </Card>
          </>,
        )}
      </Grid>
    </RealMaps>
  );
}
