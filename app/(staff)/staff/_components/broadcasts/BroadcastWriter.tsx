"use client";

import type { JSONContent } from "@tiptap/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  WhatsAppVariant,
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
  problemPlaces,
  rejectionWords,
  fakeRecipient,
  FIELD_WORDS,
  MP_NAME,
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
  MOST_PICTURE_BYTES,
  type TextButton,
  type TextHeader,
  type TextPlace,
  type TextVersion,
} from "@/lib/broadcasts/text-parts";
import { versionStanding, type VersionStanding } from "@/lib/broadcasts/version-standing";
import TextTop, { pictureSource } from "./TextTop";
import { realMapsContext } from "./PlaceMap";
import TextButtons from "./TextButtons";
import TextVersions, { type VersionSide } from "./TextVersions";
import TwoVariants from "./TwoVariants";
import MailingFiles from "../mailings/MailingFiles";
import BroadcastConsent from "./BroadcastConsent";
import { othersThanConsent } from "../supporters/SupporterFilters";
import { MailingLetter } from "../mailings/MailingLetter";
import TextBubble, { type TextDoc } from "./TextBubble";
import { cardLink, firstLink, mapsLink, type LinkCard } from "@/lib/broadcasts/link-card";
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
import { StaffSentence } from "../ui/StaffMember";

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
  /**
   * An approved template chosen in the dropdown, said to the save once, as it's chosen. The page keeps what's
   * written, not which template it is, so this only tells two templates with the same words apart.
   */
  templateId?: number;
  /** A WhatsApp broadcast's, which has no subject to be one: its template's name. */
  title: string;
  /** Its default variant's header kind, what the header shows, and its buttons; and its conditional variant (text-parts.ts). */
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

/** How a draft's words stand: an email's own, or a text's template chosen, new words, or none yet. */
type Words = "email" | "chosen" | "new" | "none";

/**
 * A quiet button pressed twice, as a delete is: the first press turns it
 * red, asking for the second (`sure`), which does it (`onConfirm`); it turns
 * back unless that comes within ARMED_FOR, or focus goes elsewhere. Red and
 * pending while what it does is under way (`pending`).
 */
function PressTwice({
  label,
  sure,
  pending = false,
  onConfirm,
}: {
  label: string;
  sure: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARMED_FOR);
    return () => clearTimeout(timer);
  }, [armed]);
  return armed || pending ? (
    <Button
      variant="danger"
      size="small"
      fit
      autoFocus
      pending={pending}
      onBlur={() => setArmed(false)}
      onClick={() => {
        setArmed(false);
        onConfirm();
      }}
    >
      {sure}
    </Button>
  ) : (
    <Button variant="ghost" size="small" fit onClick={() => setArmed(true)}>
      {label}
    </Button>
  );
}

/**
 * Under words WhatsApp is reviewing: who sent them, and when, and the button
 * that takes them back to change them, pressed twice. If taking them back
 * throws, or never arrives, it says so under the button, in the kit's words.
 */
function TemplateWithdraw({ template, withdraw }: { template: WhatsAppVariant; withdraw: () => Promise<void> }) {
  const [take, withdrawing, broke] = useSave(withdraw);
  return (
    <>
      {/* Who asked, and when, as an approved template's line says who made it; always someone, as they're sent from here. */}
      <Muted>
        <StaffSentence
          words={(who) => copy.templatePending(who, staffDate(template.requestedAt))}
          email={template.createdBy!}
        />
      </Muted>
      <div>
        <PressTwice
          label={copy.withdrawTemplate}
          sure={copy.withdrawSure}
          pending={withdrawing}
          onConfirm={() => take()}
        />
        {broke && <FieldError announce="alert">{staffVocabulary.notDone}</FieldError>}
      </div>
    </>
  );
}

/**
 * The text's own new words that WhatsApp is reviewing: their name and words
 * as they were sent, which can't be changed while it does, then taking them
 * back (TemplateWithdraw).
 */
function TemplatePending({ template, withdraw }: { template: WhatsAppVariant; withdraw: () => Promise<void> }) {
  return (
    <>
      {/* As sent: its name and its words, each under its label, as when they were written. */}
      <div className={styles.letter}>
        <p className={styles.label}>{copy.templateName}</p>
        <p className={own.sentValue}>{template.name}</p>
      </div>
      <div className={styles.letter}>
        <p className={styles.label}>{copy.templateWords}</p>
        <MailingLetter doc={template.body} fields={FIELD_WORDS} />
      </div>
      <TemplateWithdraw template={template} withdraw={withdraw} />
    </>
  );
}

/** A version's footer in the preview: its template's, as it went to WhatsApp, or for new words, the one they'd go with. */
const footerOf = (stand: VersionStanding<WhatsAppVariant>): string =>
  (stand.approved ?? stand.waiting)?.footer ?? TEMPLATE_FOOTER;

/** How long the words' link must stay the same before its page is asked for its card, so typing it doesn't ask for each letter. */
const CARD_PAUSE_MS = 600;

/**
 * A text's bubble, with the card WhatsApp shows for its link (cardLink) once
 * its page has said what goes on it; each link asked about once. Under it, a
 * warning when the first link in its words is to Google Maps, whose card
 * WhatsApp breaks (mapsLink).
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
  /** Its buttons, in WhatsApp's order (inOrder). */
  buttons: TextButton[];
}) {
  const link = cardLink(words.content, buttons);
  const wordsLink = firstLink(words.content);
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
      {wordsLink && !place && mapsLink(wordsLink) && <Alert tone="amber">{copy.mapsFirst}</Alert>}
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
  said,
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
  /** A text's place, if its top is a map, or where its picture is, if it's a picture; and its buttons, in WhatsApp's order. */
  top: { place: TextPlace | null; picture: string | null; buttons: TextButton[] };
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
    buttons: TextButton[];
    met: boolean;
    onMet: (met: boolean) => void;
  } | null;
  /** A text's footer: its chosen template's, as it went to WhatsApp, or for new words, the one they'd go with. */
  footer: string;
  subject: string;
  from: string;
  /** The connected Gmail an email goes from, which its test goes from too; none for Postmark. */
  gmail: string | null;
  /** What it still needs before there's something to test, which stops Send test. */
  needs: string[];
  /** What the preview says is wrong, under Send test (problemPlaces). */
  said: string[];
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
        <ProblemList problems={said} />
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
      title: draft.title,
      header: draft.header,
      place: draft.place,
      pictureId: draft.pictureId,
      buttons: draft.buttons,
      textVersion: draft.textVersion && {
        condition: draft.textVersion.condition,
        body: draft.textVersion.body,
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
  // A picture kept for a text's top: its ID, or why it can't be one; nothing on a page gone out of date. One too big
  // isn't sent, as more than a form can send never reaches the site to be refused.
  const uploadPicture = async (file: File) => {
    if (file.size > MOST_PICTURE_BYTES) return { refused: "too-big" as const };
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
  // A WhatsApp broadcast's conditional variant, and which of its two is open.
  const textVersion = email ? null : values.textVersion;
  const [side, setSide] = useState<VersionSide>("only");
  const body = useMemo(() => checkMailingDoc(values.body) ?? EMPTY_MAILING_DOC, [values.body]);
  const ownParts = { body, header: values.header, buttons: values.buttons };
  // Editing an approved template's words as a new one: every variant is free to change, though its words are
  // still an approved variant's.
  const [editing, setEditing] = useState(false);
  // The variants WhatsApp has approved, each once, as templates share them.
  const approved = useMemo(
    () => [
      ...new Map(
        data.templates
          .flatMap((one) => [one.default, ...(one.conditional ? [one.conditional] : [])])
          .map((variant) => [variant.id, variant]),
      ).values(),
    ],
    [data.templates],
  );
  // The approved template what's written is, whole, which the dropdown shows as chosen. Where more than one has
  // the same words, the one chosen here, or else the draft's own.
  const whole = data.templates.filter(
    (one) =>
      sameTemplate(ownParts, one.default) &&
      (textVersion
        ? one.conditional !== null &&
          one.condition === textVersion.condition &&
          sameTemplate(textVersion, one.conditional)
        : !one.conditional),
  );
  const template = editing
    ? undefined
    : (whole.find((one) => one.id === values.templateId) ??
      whole.find((one) => one.id === draft.template?.id) ??
      whole[0]);
  // How each variant stands with WhatsApp, by one rule (versionStanding), from what's written: the default one,
  // which is everyone else's once there's a conditional one (`except`), and the conditional one (`only`). Only a
  // whole approved template chosen has its words fixed: on a new template, words an approved variant has are free
  // to change, and go for approval only once they do.
  const stands: Record<VersionSide, VersionStanding<WhatsAppVariant>> = {
    except: versionStanding(ownParts, draft.variant, approved, !template),
    only: versionStanding(textVersion ?? ownParts, draft.textVersion?.variant, approved, !template),
  };
  // The default variant's words sent to WhatsApp, waiting for it to approve them.
  const { waiting } = stands.except;
  // Words WhatsApp is reviewing, either variant's, which taking back takes back together.
  const reviewing = waiting ?? (textVersion ? stands.only.waiting : undefined);
  // Once taken back, the words can be changed again: Write is brought fully into view once the page has them.
  const withdrew = useRef(false);
  const writeCard = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!withdrew.current) return;
    withdrew.current = false;
    writeCard.current!.scrollIntoView({ block: "start", behavior: "instant" });
  }, [reviewing]);
  // New template, chosen in the dropdown with nothing written yet. Words that aren't an approved template's are a
  // new one's anyway.
  const [newTab, setNewTab] = useState(false);
  const writingNew = !email && !template && (newTab || !isBlankMailing(body) || Boolean(textVersion));
  // A new template with anything written, which choosing another in the dropdown would lose: the dropdown is
  // greyed till it's discarded. Not while WhatsApp reviews it, which greys the dropdown anyway.
  const held =
    writingNew &&
    !reviewing &&
    Boolean(values.title.trim() || !isBlankMailing(body) || values.header || values.buttons.length || textVersion);
  const wordsLabel = useId();
  const picker = useId();
  // Why the template chosen wasn't deleted just now: an alert under it.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const words: Words = email ? "email" : stands.except.approved ? "chosen" : writingNew ? "new" : "none";
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
  // The preview's toggle, which switches the tabs above it too, changing how tall Write is: kept where it was on the
  // screen, so the page doesn't jump under the pointer.
  // The Preview card, which the toggle is in: held, it holds the toggle, whatever has the focus.
  const previewCard = useRef<HTMLElement | null>(null);
  const kept = useRef<{ element: Element; top: number } | null>(null);
  const keepInPlace = () => {
    const card = previewCard.current!;
    kept.current = { element: card, top: card.getBoundingClientRect().top };
  };
  useLayoutEffect(() => {
    const place = kept.current;
    if (!place) return;
    kept.current = null;
    // Now, and each time the page's height changes for two seconds after, as the open tab's editor fills in once
    // it's drawn, however slowly. Instantly, as the site's pages scroll smoothly, which would make each a slow slide.
    const hold = () =>
      window.scrollBy({ top: place.element.getBoundingClientRect().top - place.top, behavior: "instant" });
    hold();
    const resized = new ResizeObserver(hold);
    resized.observe(document.body);
    const done = setTimeout(() => resized.disconnect(), 2000);
    return () => {
      resized.disconnect();
      clearTimeout(done);
    };
  }, [side]);
  // Made anew when its words are put in from the second version, as an editor reads its words once.
  const [ownKey, setOwnKey] = useState(0);
  const versionLabel = useId();
  const condition = textVersion && data.conditions.find((one) => one.id === textVersion.condition);
  const versionWho = condition?.label ?? textVersion?.condition ?? "";
  // Who a template's conditional variant is for, as its tab says it, or its condition where the site has no words
  // for it.
  const conditionWords = (id: string) => data.conditions.find((one) => one.id === id)?.label ?? id;
  const versionCovers = condition?.covers ?? 0;
  // Whose words are new, to go to WhatsApp for approval: neither an approved variant's nor with it already.
  const toApprove = {
    except: writingNew && !stands.except.approved && !waiting,
    only: Boolean(textVersion) && !stands.only.approved && !stands.only.waiting,
  };
  // How many variants Send for approval sends: one for each with new words, but one for both when they'd be the same
  // variant (submitTemplate).
  const toSubmit = (toApprove.except ? 1 : 0) + (toApprove.only && !sameTemplate(textVersion!, ownParts) ? 1 : 0);
  // A change to what's written. Each says the template's name too, as the save names the template by it. Once no
  // variant's words are an approved one's, they're new by themselves, so they're no longer being edited as new.
  const write = (patch: Partial<Changes>) => {
    change(email ? patch : { title: values.title, ...patch });
    const next = { ...values, ...patch };
    const mine = { body: next.body, header: next.header, buttons: next.buttons };
    const still = [mine, ...(next.textVersion ? [next.textVersion] : [])].some((parts) =>
      approved.some((one) => sameTemplate(parts, one)),
    );
    if (!still) setEditing(false);
  };
  // A change to the default variant's words, header kind, place, picture or buttons.
  const changeOwn = (patch: Partial<Pick<Changes, "body" | "header" | "place" | "pictureId" | "buttons">>) =>
    write(patch);
  // The same to the conditional variant's, which is saved whole.
  const changeVersion = (patch: Partial<TextVersion>) => write({ textVersion: { ...textVersion!, ...patch } });
  // A conditional variant for those who meet `chosen`: a copy of the default one as it is.
  const addVersion = (chosen: string) => {
    write({
      textVersion: {
        condition: chosen,
        body,
        header: values.header,
        place: values.place,
        pictureId: values.pictureId,
        buttons: values.buttons,
      },
    });
    setSide("only");
  };
  // The open variant's ×: it goes, and the other is the broadcast for everyone.
  const removeOpen = () => {
    if (side === "only") return write({ textVersion: null });
    const { body: kept, header, place, pictureId, buttons } = textVersion!;
    write({ body: kept, header, place, pictureId, buttons, textVersion: null });
    setOwnKey((n) => n + 1);
  };
  // A picture pasted in Write, for the picture box of the variant it's for to upload.
  const [pasted, setPasted] = useState<{ side: VersionSide; file: File } | null>(null);
  const pastedTaken = useCallback(() => setPasted(null), []);
  // A picture pasted anywhere in Write, words and all, is the open variant's header, as words can't hold one; but
  // not where its header is fixed as another kind, or WhatsApp is reviewing it.
  const pastePicture = (event: React.ClipboardEvent) => {
    const file = [...event.clipboardData.files].find((one) => one.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    const open: VersionSide = textVersion && side === "only" ? "only" : "except";
    const fixedTop = open === "only" ? stands.only.fixed : stands.except.fixed || !writingNew;
    const topHeader = open === "only" ? textVersion!.header : values.header;
    if (stands[open].waiting || (fixedTop && topHeader !== "image")) return;
    // Its header a picture, whose box uploads it as one chosen there, saying there what's wrong with it.
    if (topHeader !== "image") {
      if (open === "only") changeVersion({ header: "image" });
      else changeOwn({ header: "image" });
    }
    setPasted({ side: open, file });
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
    withoutMp: data.fields.find((field) => field.id === MP_NAME)?.lacking ?? 0,
    writing: words !== "none",
    unknown: data.unknown,
    byGmail: gmailChecked,
    connected: data.sender.connected,
    remaining,
    daily,
    approved: Boolean(stands.except.approved),
    sameWords: sameWords(
      body,
      approved.map((one) => one.body),
    ),
    numbered: Boolean(data.textNumber),
    sends: data.sends,
    header: values.header,
    place: values.place,
    pictureId: values.pictureId,
    buttons: values.buttons,
    textVersion: textVersion && {
      ...textVersion,
      approved: Boolean(stands.only.approved),
      sameWords: sameWords(
        textVersion.body,
        approved.map((one) => one.body),
      ),
    },
  }).filter((problem) => problem !== "cannot-send");
  // Each said once, in the first place down the page that says it (problemPlaces). Greyed, before a Consent by the
  // channel picked: that comes first, till one's picked.
  const approving = toSubmit > 0;
  // The preview says nothing for a text with no template chosen yet, but to choose one (Preview).
  const placed = problemPlaces(problems, approving, words !== "none" || Boolean(textVersion));
  const shownProblems = [...(blank && !picked ? ["no-consent" as const] : []), ...placed.send];
  // A text with a version WhatsApp hasn't approved yet: new words, or ones it's reviewing.
  const unapproved = !email && (words === "new" || Boolean(textVersion && !stands.only.approved));
  const fromName = email ? draft.fromName || BROADCAST_SENDER.name : TEXT_SENDER_NAME;
  const fromLine = email ? named(fromName, draft.sentFrom!) : TEXT_SENDER_NAME;
  // In Send, as the broadcast's page has it: the address, or a text's WhatsApp number once there is one, the
  // name under it; with no number yet, the name alone.
  const fromAddress = email ? draft.sentFrom! : data.textNumber && phoneWords(data.textNumber);
  // A WhatsApp broadcast is called what its template is.
  const name = template ? template.name : values.title;
  const title = email ? values.subject.trim() || copy.newTitle.email : name.trim() || copy.newTitle.text;
  const whoPath = filtersPath("/staff/supporters", { ...data.filter.params, broadcast: String(id) });
  // To the list, to change who: what's typed is saved first, so going there loses none of it.
  const [toList] = useSave(async () => {
    await saveNow();
    leavePage(whoPath);
  });
  const hasOwnWords = hasWords({ subject: values.subject, body, templateId: template?.id ?? null });
  // Before a Consent by the channel picked, what's still to come: there, but greyed and out of reach.
  const lockable = (children: ReactNode) =>
    blank ? (
      <div inert className={own.locked}>
        {children}
      </div>
    ) : (
      children
    );
  // Choosing in the dropdown: a new template, empty, with no name, words, header, buttons or condition, unless it's
  // what's being written already; or an approved template, whole, its variants and who the conditional one is for.
  // Only Edit as a new template starts from words there are.
  const chooseWords = (value: string) => {
    if (value === "new") {
      if (writingNew) return;
      setEditing(false);
      change({
        title: "",
        body: EMPTY_MAILING_DOC,
        header: null,
        place: null,
        pictureId: null,
        buttons: [],
        textVersion: null,
      });
      setOwnKey((n) => n + 1);
      setNewTab(true);
      return;
    }
    setEditing(false);
    const one = data.templates.find((each) => String(each.id) === value)!;
    change({
      templateId: one.id,
      title: one.name,
      body: one.default.body,
      header: one.default.header,
      buttons: one.default.buttons,
      textVersion: one.conditional && {
        condition: one.condition!,
        body: one.conditional.body,
        header: one.conditional.header,
        buttons: one.conditional.buttons,
        place: textVersion?.place ?? null,
        pictureId: textVersion?.pictureId ?? null,
      },
    });
    setNewTab(false);
    if (one.conditional) setSide("only");
  };
  // Discards a new template being written: everything of it gone, and the dropdown free to choose again.
  const discard = () => {
    change({
      title: "",
      body: EMPTY_MAILING_DOC,
      header: null,
      place: null,
      pictureId: null,
      buttons: [],
      textVersion: null,
    });
    setEditing(false);
    setOwnKey((n) => n + 1);
    setNewTab(false);
  };
  // Takes the words WhatsApp is reviewing back from it, the text's own and its second version's, to change them.
  const withdraw = async () => {
    const result = await unlessStale(actions.withdrawTemplate(id));
    // An outdated page says so over the draft, not here.
    if (!result) return;
    // They wait for WhatsApp no longer, so Send for approval, once it's back, waits for nothing.
    setSubmitted(false);
    // With none waiting to take back, the page is back as the template stands, and its top says so.
    if (!result.ok) return tell(copy.refusals.withdraw.gone);
    withdrew.current = true;
    router.refresh();
  };
  // As the page has them, this draft has its template saved: how many others have each.
  const others = (one: WhatsAppTemplate): TemplateUses =>
    draft.template?.id === one.id ? { ...one.uses, drafts: one.uses.drafts - 1 } : one.uses;
  const unused = (one: WhatsAppTemplate) => Object.values(others(one)).every((n) => n === 0);
  // Edit as new template, for an approved template chosen: a copy under a new name, every variant's words free to
  // change. Nothing is new till a variant's words, header kind or buttons change, and then only that variant goes
  // for approval.
  const editAsNew = (chosen: WhatsAppTemplate) => {
    change({
      title: copyName(
        chosen.name,
        data.templates.map((one) => one.name),
      ),
    });
    setEditing(true);
  };
  // Deleting the template chosen: this draft lets it go first, so nothing has it, and chooses again after. Letting
  // it go takes its line away, and its button with it, so why it wasn't deleted is said under the dropdown.
  const deleteChosen = async (one: WhatsAppTemplate): Promise<FormResult<never>> => {
    setDeleteError(null);
    change({ title: "", body: EMPTY_MAILING_DOC, header: null, buttons: [], textVersion: null });
    setNewTab(false);
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
      onChange={(doc) => changeOwn({ body: doc as MailingDoc })}
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
      const { waiting: sent, rejected, fixed } = stands.only;
      return (
        <div className={`${own.textWords} ${own.versionWords}`}>
          {/* WhatsApp rejected its words: why, till they're sent again. */}
          {rejected && <Strip tone="red">{copy.rejected(rejectionWords(rejected.rejectedReason))}</Strip>}
          <TextTop
            header={version.header}
            place={version.place}
            pictureId={version.pictureId}
            link={firstLink(version.body.content)}
            onChange={(top) => changeVersion(top)}
            findPlaces={findPlaces}
            uploadPicture={uploadPicture}
            fixed={fixed}
            pasted={pasted?.side === "only" ? pasted.file : null}
            onPastedTaken={pastedTaken}
          />
          <div className={styles.letter}>
            <p id={versionLabel} className={styles.label}>
              {copy.templateWords}
            </p>
            {fixed ? (
              <MailingLetter doc={version.body} fields={FIELD_WORDS} />
            ) : (
              <MailingEditor
                key={`${restored}-${version.condition}`}
                initial={version.body as JSONContent}
                onChange={(doc) => changeVersion({ body: doc as MailingDoc })}
                fields={data.fields}
                conditions={data.conditions}
                whatsApp
                textParts={textParts}
                recipients={data.count}
                labelledBy={versionLabel}
              />
            )}
          </div>
          <TextButtons buttons={version.buttons} onChange={(buttons) => changeVersion({ buttons })} fixed={fixed} />
          {/* With the default variant's words WhatsApp's too, they're taken back there, together. */}
          {sent && !waiting && <TemplateWithdraw template={sent} withdraw={withdraw} />}
        </div>
      );
    }
    // Fixed, too, with nothing chosen yet to have a header or buttons of its own.
    const fixed = stands.except.fixed || !writingNew;
    return (
      // In its box, once there's a second version, which has no padding under it of its own.
      <div className={textVersion ? `${own.textWords} ${own.versionWords}` : own.textWords}>
        <TextTop
          header={values.header}
          place={values.place}
          pictureId={values.pictureId}
          link={firstLink(body.content)}
          onChange={(top) => changeOwn(top)}
          findPlaces={findPlaces}
          uploadPicture={uploadPicture}
          fixed={fixed}
          pasted={pasted?.side === "except" ? pasted.file : null}
          onPastedTaken={pastedTaken}
        />
        {writingNew && !stands.except.fixed && (
          <div className={styles.letter}>
            <p id={wordsLabel} className={styles.label}>
              {copy.templateWords}
            </p>
            {wordsEditor(wordsLabel)}
            <Hint>{copy.newTemplateHint}</Hint>
          </div>
        )}
        {/* An approved variant's words, fixed, where the page shows them nowhere else: beside the other variant's
            in its tab, or in a template still being written. A whole template's alone show once, in the preview. */}
        {stands.except.chosen && textVersion && (
          <div className={styles.letter}>
            <p className={styles.label}>{copy.templateWords}</p>
            <MailingLetter doc={body} fields={FIELD_WORDS} />
          </div>
        )}
        <TextButtons buttons={values.buttons} onChange={(buttons) => changeOwn({ buttons })} fixed={fixed} />
      </div>
    );
  };
  return (
    <realMapsContext.Provider value={data.realMaps}>
      {/* While a Consent's change is under way, that in place of whether it's saved; what's not a draft yet has neither. */}
      <DraftTitle title={title} saveState={calculating ? "calculating" : blank ? undefined : saveState} />
      {saveState === "conflict" && (
        <Strip tone="red" announce>
          {mailingsCopy.mailingPages.saveStates.conflict}
        </Strip>
      )}
      {reviewing && (
        <Strip tone="blue" waiting>
          <StaffSentence
            words={(who) => copy.awaitingApproval(who, staffTime(reviewing.requestedAt))}
            email={reviewing.createdBy!}
          />
        </Strip>
      )}
      {stands.except.rejected && (
        <Strip tone="red">{copy.rejected(rejectionWords(stands.except.rejected.rejectedReason))}</Strip>
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
                  {/* Beside it, what can be done to the template chosen: its words as a new template, and deleting it
                      while nothing else has it; or for a new template being written, discarding it. */}
                  <div className={own.templateRow}>
                    <div className={styles.sender}>
                      <MenuSelect
                        id={picker}
                        label={copy.templateLabel}
                        placeholder={copy.pickTemplate}
                        value={template ? String(template.id) : writingNew ? "new" : ""}
                        disabled={Boolean(reviewing) || held}
                        // A template with two variants is marked so, in place of a tag.
                        options={data.templates.map((one) => ({
                          value: String(one.id),
                          label: one.name,
                          ...templateOption(one, others(one)),
                          ...(one.condition !== null && { mark: <TwoVariants who={conditionWords(one.condition)} /> }),
                        }))}
                        last={{ value: "new", label: copy.newTemplate }}
                        onChange={chooseWords}
                      />
                    </div>
                    {template ? (
                      <div className={own.templateActions}>
                        <Button variant="ghost" size="small" fit onClick={() => editAsNew(template)}>
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
                    ) : (
                      held && (
                        <PressTwice
                          label={copy.discardTemplate}
                          sure={staffVocabulary.deleteItShort}
                          onConfirm={discard}
                        />
                      )
                    )}
                  </div>
                  {deleteError && <Alert>{deleteError}</Alert>}
                  {writingNew && waiting && <TemplatePending template={waiting} withdraw={withdraw} />}
                  {/* What they're called in the list of templates, once approved, and what the broadcast is. */}
                  {writingNew && !waiting && (
                    <Field label={copy.templateName} className={styles.sender}>
                      <TextInput value={values.title} onChange={(event) => change({ title: event.target.value })} />
                    </Field>
                  )}
                  {textVersion ? (
                    <TextVersions
                      who={versionWho}
                      counts={{ only: versionCovers, except: data.count - versionCovers }}
                      open={side}
                      onOpen={setSide}
                      templates={toSubmit}
                      // Not while WhatsApp is reviewing either version's words, which making one the whole text
                      // would change.
                      onRemove={reviewing ? undefined : removeOpen}
                    >
                      {versionParts(side)}
                    </TextVersions>
                  ) : (
                    (words !== "none" || writingNew) && versionParts("except")
                  )}
                  {/* With an approved variant's words, there's no editor to have the parts beside it: they come
                      after its header and buttons. */}
                  {stands.except.chosen && !textVersion && <div className={own.textParts}>{textParts}</div>}
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
              title={<Numbered n={4}>{approving ? copy.previewNew : copy.sections.preview}</Numbered>}
              id="preview-title"
              ref={(element) => {
                previewCard.current = element;
              }}
            >
              <BroadcastPreview
                data={data}
                draft={draft}
                body={body}
                words={words}
                footer={footerOf(stands.except)}
                top={{
                  place: values.header === "location" ? values.place : null,
                  picture: values.header === "image" && values.pictureId ? pictureSource(values.pictureId) : null,
                  buttons: inOrder(values.buttons),
                }}
                textVersion={
                  textVersion && {
                    condition: textVersion.condition,
                    body: textVersion.body,
                    // Testable once WhatsApp has approved its words, fixed or not.
                    words: stands.only.approved ? "chosen" : "new",
                    footer: footerOf(stands.only),
                    place: textVersion.header === "location" ? textVersion.place : null,
                    picture:
                      textVersion.header === "image" && textVersion.pictureId
                        ? pictureSource(textVersion.pictureId)
                        : null,
                    buttons: inOrder(textVersion.buttons),
                    met: side === "only",
                    onMet: (met) => {
                      keepInPlace();
                      setSide(met ? "only" : "except");
                    },
                  }
                }
                approval={
                  // New words go to WhatsApp from here, under how they'll look, once they're written, before a test,
                  // which can only go once WhatsApp approves them.
                  approving && (
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
                      <ProblemList problems={placed.approval.map((problem) => copy.problems[problem])} />
                      {/* Why it didn't go: sending it broke, or what the site or WhatsApp said of it. */}
                      {(submitBroke || submitError) && <Alert>{submitBroke ? copy.submitBroke : submitError}</Alert>}
                    </div>
                  )
                }
                subject={values.subject}
                from={fromLine}
                gmail={gmailChecked && data.sender.connected ? draft.sentFrom : null}
                needs={problems.filter((problem) => TEST_NEEDS.includes(problem))}
                said={placed.preview.map((problem) => copy.problems[problem])}
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
              {/* A text WhatsApp hasn't approved, either version of it, due sooner than it may take to. */}
              {unapproved && values.dueAt && new Date(values.dueAt).getTime() - now().getTime() < APPROVAL_MS && (
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
                  it's scheduled, the text's own or its second version's, unless they're with it already. */}
              <ProblemList
                problems={shownProblems.map((problem) => copy.problems[problem])}
                notes={toSubmit > 0 ? [copy.schedulesForApproval(toSubmit)] : []}
              />
            </Card>
          </>,
        )}
      </Grid>
    </realMapsContext.Provider>
  );
}
