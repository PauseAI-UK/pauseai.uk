"use client";

import type { JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { useLeaving } from "@/components/ui/useLeaving";
import { staffCopy } from "@/lib/content/staff-interface";
import { looksLikeEmail } from "@/lib/email-your-mp";
import { leavePage } from "@/lib/leave-page";
import {
  checkMailingDoc,
  conditionsIn,
  EMPTY_MAILING_DOC,
  fieldsIn,
  isBlankMailing,
  letterFor,
  NOT_CONDITION,
  type MailingDoc,
} from "@/lib/mailing-doc";
import { named } from "@/lib/email-parsing/addresses";
import type { ChannelResult } from "@/lib/server/mailing-channels";
import type {
  BroadcastScheduleResult,
  WhatsAppTemplate,
  TemplateSubmitResult,
  WrittenBroadcast,
} from "@/lib/server/broadcast-drafts";
import type { BroadcastWriterData } from "@/lib/server/broadcast-pages";
import { filtersPath } from "@/lib/staff-search";
import { earliestHour, londonClock, londonWhen, sendsAt, staffDate, staffTime } from "@/lib/staff-time";
import { stateValue, type Channel } from "@/lib/contact-permissions";
import {
  approvalProblems,
  fakeRecipient,
  hasField,
  hasWords,
  BROADCAST_START,
  textCost,
  broadcastScheduleProblems,
  BROADCAST_SENDER,
  spacedNumber,
  textSender,
  TEXT_SENDER_NAME,
} from "@/lib/broadcasts";
import {
  DraftTitle,
  DueSection,
  ProblemList,
  ScheduleButton,
  TEST_NEEDS,
  useDraftWriter,
  type DraftActions,
} from "./DraftWriter";
import { SentToday } from "./GmailConnect";
import { ARMED_FOR } from "./DeleteTwice";
import { DeleteDraft } from "./MailingButtons";
import MailingEditor from "./MailingEditor";
import MailingFiles from "./MailingFiles";
import BroadcastConsent from "./BroadcastConsent";
import { MailingLetter } from "./MailingLetter";
import TextBubble from "./TextBubble";
import Grid, { Card } from "./ui/Grid";
import NotIcon from "./ui/NotIcon";
import Strip from "./ui/Strip";
import Numbered from "./ui/Numbered";
import styles from "./MailingWriter.module.css";
import own from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

/** What a broadcast's page can change. */
type Changes = {
  subject: string;
  body: MailingDoc;
  sentFrom: string | null;
  fromName: string | null;
  dueAt: Date | null;
  templateId: number | null;
  /** A text's, which has no subject to be one. */
  title: string;
};

/** The broadcast pages' Server Actions (app/(staff)/staff/broadcast-actions.ts), which the page hands in. */
export type BroadcastWriterActions = DraftActions & {
  /** Sends `to` a test copy, filled in for a made-up recipient meeting `meets` (fakeRecipient). */
  sendTest: (id: number, meets: string[], to: string) => Promise<(ChannelResult & { to: string }) | undefined>;
  schedule: (id: number, version: number) => Promise<BroadcastScheduleResult>;
  deleteDraft: (form: FormData) => void | Promise<void>;
  /** Changes the Consent a draft goes under; says whether it did. */
  changeConsent: (id: number, consent: string) => Promise<boolean>;
  /** Makes a draft under a Consent, from New broadcast, and opens it. */
  create: (consent: string) => Promise<void>;
  /** Sends a text's new words to WhatsApp for approval, by the name they're given. */
  submitTemplate: (id: number) => Promise<TemplateSubmitResult>;
  /** Takes them back, so they can be changed; says whether it did. */
  withdrawTemplate: (id: number) => Promise<boolean>;
};

/** Who made a template, when it was approved and when it was last used, in words. */
export function templateLine(template: WhatsAppTemplate): string {
  return copy.templateBy(
    template.createdBy ?? copy.templateMadeIn,
    staffDate(template.approvedAt!),
    template.lastUsedAt
      ? copy.templateUsed(staffDate(template.lastUsedAt), template.lastUsedTo)
      : copy.templateNeverUsed,
  );
}

/** How a draft's words stand: an email's own, or a text's template chosen, new words, or none yet. */
type Words = "email" | "chosen" | "new" | "none";

/**
 * New words WhatsApp is reviewing: their name and words as they were sent,
 * which can't be changed while it does, and the button that takes them back
 * to change them.
 */
function TemplatePending({ template, withdraw }: { template: WhatsAppTemplate; withdraw: () => Promise<void> }) {
  const fields = Object.fromEntries(Object.entries(copy.fieldWords));
  const [withdrawing, setWithdrawing] = useState(false);
  const [armed, setArmed] = useState(false);
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
      <Muted>{copy.templatePending(template.createdBy!, staffDate(template.requestedAt))}</Muted>
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
            onClick={async () => {
              setWithdrawing(true);
              await withdraw();
              setWithdrawing(false);
              setArmed(false);
            }}
          >
            {copy.withdrawSure}
          </Button>
        ) : (
          <Button variant="ghost" size="small" fit onClick={() => setArmed(true)}>
            {copy.withdrawTemplate}
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * Each recipient's copy, as they'll get it: an email as a mail app shows
 * it, or a text as a bubble. Over it, a button for each field the words use
 * and each condition of their parts, pressed for those who have or meet it,
 * each press choosing a recipient like that. With no one like that, no
 * copy, as there's no one to fill it in for. Under it, a test copy.
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
}: {
  data: BroadcastWriterData;
  draft: WrittenBroadcast;
  body: MailingDoc;
  words: Words;
  subject: string;
  from: string;
  /** The connected Gmail an email goes from, which its test goes from too; none for Postmark. */
  gmail: string | null;
  /** What it still needs before there's something to test, as the Send section says it. */
  needs: string[];
  dueAt: Date | null;
  sendTest: (meets: string[], to: string) => ReturnType<BroadcastWriterActions["sendTest"]>;
}) {
  const email = draft.channel === "email";
  const testId = useId();
  const findLabel = useId();
  const [testTo, setTestTo] = useState(email ? data.me : "");
  // Each button's answer: unpressed, the made-up recipient lacks that field or condition.
  const [lacks, setLacks] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<{ to?: string } | undefined>();
  const [sending, setSending] = useState(false);
  if (words === "none") return <p className={styles.noEmail}>{copy.chooseTemplate}</p>;
  const used = [
    ...new Set([
      ...fieldsIn(body).map(hasField),
      ...conditionsIn(body).map((c) => (c.startsWith(NOT_CONDITION) ? c.slice(NOT_CONDITION.length) : c)),
    ]),
  ];
  const meets = Object.fromEntries(used.map((c) => [c, !lacks[c]]));
  const met = used.filter((c) => meets[c]);
  const recipient = fakeRecipient(met, draft.channel);
  // Of the one made-up recipient, so "have a first name"; a part's own words where a condition has none here.
  const labels: Record<string, string> = {
    ...Object.fromEntries(data.conditions.map((condition) => [condition.id, condition.label])),
    ...copy.previewCases,
  };
  const toggle = (condition: string) => {
    setLacks({ ...lacks, [condition]: meets[condition] });
    setSent(undefined);
  };
  const canTest =
    needs.length === 0 && (email ? looksLikeEmail(testTo.trim()) : words === "chosen" && data.sends && testTo.trim());
  const testNote = email
    ? gmail
      ? copy.testVia.emailGmail(gmail)
      : copy.testVia.email(BROADCAST_SENDER.email)
    : !data.sends || !data.textNumber
      ? copy.testVia.textOff
      : words === "chosen"
        ? copy.testVia.text(spacedNumber(data.textNumber))
        : copy.testVia.textNew;
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
                <button type="button" aria-pressed={meets[condition]} onClick={() => toggle(condition)}>
                  {!meets[condition] && <NotIcon />}
                  {labels[condition] ?? condition}
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
        <TextBubble
          from={TEXT_SENDER_NAME}
          words={letterFor(body, recipient)}
          time={londonClock(sendsAt(dueAt ?? earliestHour()))}
        />
      )}

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
          <Button
            variant="primary"
            fit
            disabled={!canTest}
            pending={sending}
            onClick={async () => {
              setSending(true);
              const result = await sendTest(met, testTo.trim());
              setSending(false);
              setSent({ to: result?.sent ? result.to : undefined });
            }}
          >
            {copy.sendTest}
          </Button>
        </div>
        <Muted>{testNote}</Muted>
        <Muted>
          <span role="status">{sent && (sent.to ? copy.testSent(sent.to) : copy.testFailed)}</span>
        </Muted>
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
  const [picking, setPicking] = useState(false);
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
  const { values, change, saveNow, saveState, version, attachments, attach, detach, fileProblem } =
    useDraftWriter<Changes>({
      id,
      version: draft.version,
      initial: {
        subject: draft.subject,
        body: draft.body,
        sentFrom: draft.sentFrom,
        fromName: draft.fromName || null,
        dueAt: draft.dueAt,
        templateId: draft.template?.status === "approved" ? draft.template.id : null,
        title: draft.title,
      },
      fresh,
      attachments: draft.attachments,
      actions,
    });
  const [choosing, choose] = useLeaving();
  const [submitting, setSubmitting] = useState(false);
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
  const body = useMemo(() => checkMailingDoc(values.body) ?? EMPTY_MAILING_DOC, [values.body]);
  const template = data.templates.find((one) => one.id === values.templateId);
  const words: Words = email ? "email" : writingNew ? "new" : template ? "chosen" : "none";
  const written = email
    ? !isBlankMailing(body) && JSON.stringify(body) !== JSON.stringify(start)
    : !isBlankMailing(body);
  const sender = data.senders.find((one) => one.email === values.sentFrom);
  const byGmail = email && values.sentFrom !== BROADCAST_SENDER.email;
  const problems = broadcastScheduleProblems({
    channel: draft.channel,
    subject: values.subject,
    title: values.title,
    body: written ? body : EMPTY_MAILING_DOC,
    dueAt: values.dueAt,
    recipients: data.count,
    unknown: data.unknown,
    byGmail,
    connected: Boolean(sender),
    approved: words === "chosen",
    numbered: Boolean(data.textNumber),
    sends: data.sends,
  }).filter((problem) => problem !== "cannot-send");
  // Greyed, before a Consent by the channel picked: that comes first.
  const shownProblems = blank ? ["no-consent", ...problems] : problems;
  const fromName = email ? values.fromName || (byGmail ? sender?.name : BROADCAST_SENDER.name) : TEXT_SENDER_NAME;
  const fromLine = email ? named(fromName, values.sentFrom!) : TEXT_SENDER_NAME;
  // In the summary, a text's WhatsApp number too, once there is one, as an email's address.
  const summaryFrom = email || !data.textNumber ? fromLine : textSender(TEXT_SENDER_NAME, data.textNumber);
  const title = email ? values.subject.trim() || copy.newTitle.email : values.title.trim() || copy.newTitle.text;
  const whoPath = filtersPath("/staff/supporters", { ...data.filter.params, broadcast: String(id) });
  const hasOwnWords = hasWords({ subject: values.subject, body, templateId: values.templateId });
  // Choosing a Consent: on New broadcast, makes the draft; on a draft, saves what's typed, then changes it.
  const pickConsent = async (consent: string) => {
    setPicking(true);
    try {
      if (creating) return await actions.create(consent);
      await saveNow();
      if (await actions.changeConsent(id, consent)) router.refresh();
    } finally {
      setPicking(false);
    }
  };
  // Before a Consent by the channel picked, what's still to come: there, but greyed and out of reach.
  const lockable = (children: ReactNode) =>
    blank ? (
      <div inert className={own.locked}>
        {children}
      </div>
    ) : (
      children
    );
  // Choosing a template takes its words and name; new words, and their name, are kept while one is chosen.
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
    change({ templateId: one.id, body: one.body, title: one.name });
    setWritingNew(false);
  };
  const wordsEditor = (labelledBy: string) => (
    <MailingEditor
      initial={values.body as JSONContent}
      onChange={(doc) => change({ body: doc as MailingDoc })}
      fields={data.fields}
      conditions={data.conditions}
      whatsApp={!email}
      recipients={data.count}
      labelledBy={labelledBy}
    />
  );
  return (
    <>
      <DraftTitle title={title} saveState={blank ? undefined : saveState} />
      {!data.sends && <Strip tone="amber">{copy.cantSend}</Strip>}
      {saveState === "conflict" && (
        <Strip tone="red" announce>
          {staffCopy.mailingPages.saveStates.conflict}
        </Strip>
      )}
      {draft.template?.status === "pending" && (
        <Strip tone="amber">
          {copy.awaitingApproval(draft.template.createdBy!, staffTime(draft.template.requestedAt))}
        </Strip>
      )}
      {draft.template?.status === "rejected" && (
        <Strip tone="red">{copy.rejected(staffTime(draft.template.rejectedAt!), draft.template.rejectedReason!)}</Strip>
      )}
      <Grid>
        <Card span={6} title={<Numbered n={1}>{copy.sections.who}</Numbered>} id="who-title">
          <BroadcastConsent
            value={
              blank
                ? ""
                : stateValue({
                    channel: draft.channel === "email" ? "email" : "phone",
                    topic: draft.topic,
                    send: "yes",
                  })
            }
            channel={draft.channel === "email" ? "email" : "phone"}
            written={hasOwnWords}
            pending={picking}
            pick={pickConsent}
            shown={shown}
            show={show}
            className={own.consent}
          />
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
                  onClick={async (event) => {
                    // What's typed is saved first, so going to the list loses none of it.
                    event.preventDefault();
                    choose();
                    await saveNow();
                    leavePage(whoPath);
                  }}
                >
                  {staffCopy.mailingPages.changeWho}
                </ButtonAnchor>
              </div>
              {data.unknown.length > 0 && (
                <Strip tone="amber">{staffCopy.mailingPages.unknownFilter(data.unknown.join(", "))}</Strip>
              )}
              {/* Greyed, it's to no one yet: who the Consent finds once it's chosen. */}
              {!blank && <p className={styles.count}>{copy.willGet(data.count, draft.channel)}</p>}
            </>,
          )}
        </Card>

        {lockable(
          <>
            <Card span={6} title={<Numbered n={2}>{copy.sections.from}</Numbered>} id="from-title">
              {email ? (
                <div className={styles.from}>
                  <div className={styles.fromFields}>
                    <Field label={copy.fromAccount} className={styles.sender}>
                      <Select value={values.sentFrom!} onChange={(event) => change({ sentFrom: event.target.value })}>
                        {/* Each address with what sends from it: ours by Postmark, a staff member's by their Gmail. */}
                        <option value={BROADCAST_SENDER.email}>
                          {copy.fromOption(BROADCAST_SENDER.email, "Postmark")}
                        </option>
                        {data.senders.map((one) => (
                          <option key={one.email} value={one.email}>
                            {copy.fromOption(one.email, "Gmail")}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={copy.fromName} className={styles.sender}>
                      <TextInput
                        value={values.fromName ?? ""}
                        onChange={(event) => change({ fromName: event.target.value })}
                      />
                    </Field>
                  </div>
                  {/* A Gmail's sending today, against its daily limit, as a mailing's writer says it. */}
                  {sender && <SentToday sent={sender.sentToday} />}
                </div>
              ) : (
                <div className={own.account}>
                  <span className={own.picture} aria-hidden="true">
                    {TEXT_SENDER_NAME[0]}
                  </span>
                  <p>
                    <strong>{TEXT_SENDER_NAME}</strong>{" "}
                    <Muted>
                      {data.textNumber ? (
                        <span className={own.number}>{spacedNumber(data.textNumber)}</span>
                      ) : (
                        copy.noNumber
                      )}
                    </Muted>
                  </p>
                </div>
              )}
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
                <div className={own.textWords}>
                  {/* An approved template, or new words, the last choice; while WhatsApp reviews new words, they stay chosen. */}
                  <Field label={copy.templateLabel} className={styles.sender}>
                    <Select
                      value={writingNew ? "new" : (template?.id ?? "")}
                      disabled={Boolean(waiting)}
                      onChange={(event) => chooseWords(event.target.value)}
                    >
                      {!writingNew && !template && (
                        <option value="" disabled>
                          {copy.pickTemplate}
                        </option>
                      )}
                      {data.templates.map((one) => (
                        <option key={one.id} value={one.id}>
                          {one.name}
                        </option>
                      ))}
                      {/* A rule between the approved templates and new words, as browsers draw one in a select's list. */}
                      {data.templates.length > 0 && <hr />}
                      <option value="new">{copy.newTemplate}</option>
                    </Select>
                  </Field>
                  {/* Its words show once, in the preview; here, who made it and when it was last used. */}
                  {template && <Muted>{templateLine(template)}</Muted>}
                  {writingNew &&
                    (waiting ? (
                      <TemplatePending
                        template={waiting}
                        withdraw={async () => {
                          if (await actions.withdrawTemplate(id)) {
                            withdrew.current = true;
                            router.refresh();
                          }
                        }}
                      />
                    ) : (
                      <>
                        {/* What they're called in the list of templates, once approved, and what the broadcast is. */}
                        <Field label={copy.templateName} className={styles.sender}>
                          <TextInput value={values.title} onChange={(event) => change({ title: event.target.value })} />
                        </Field>
                        <div className={styles.letter}>
                          <p id={wordsLabel} className={styles.label}>
                            {copy.templateWords}
                          </p>
                          {wordsEditor(wordsLabel)}
                          <Hint>{copy.newTemplateHint}</Hint>
                        </div>
                      </>
                    ))}
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

            <Card span={6} title={<Numbered n={4}>{copy.sections.preview}</Numbered>} id="preview-title">
              <BroadcastPreview
                data={data}
                draft={draft}
                body={body}
                words={words}
                subject={values.subject}
                from={fromLine}
                gmail={byGmail && sender ? sender.email : null}
                needs={problems
                  .filter((problem) => TEST_NEEDS.includes(problem))
                  .map((problem) => copy.problems[problem])}
                dueAt={values.dueAt}
                sendTest={async (meets, to) => {
                  // The test is of the draft as saved, so what's typed goes first.
                  await saveNow();
                  return actions.sendTest(id, meets, to);
                }}
              />
            </Card>

            <Card span={6} title={<Numbered n={5}>{copy.sections.when}</Numbered>} id="when-title">
              <DueSection dueAt={values.dueAt} onChange={(dueAt) => change({ dueAt })} />
            </Card>

            <Card span={6} title={<Numbered n={6}>{copy.sections.send}</Numbered>} id="send-title">
              <p className={styles.count}>
                {copy.summary(
                  data.count,
                  draft.channel,
                  summaryFrom,
                  values.dueAt ? londonWhen(values.dueAt, "short") : null,
                )}{" "}
                {!email && (
                  <>
                    {textCost(data.count).about}
                    <span className={own.rate}>{textCost(data.count).rate}</span>
                  </>
                )}
              </p>
              <div className={styles.send}>
                {/* New words go to WhatsApp from here, at the foot, once they're written, in Schedule's
                    place, as they can't be scheduled till WhatsApp approves them. */}
                {words === "new" && !waiting ? (
                  <Button
                    variant="primary"
                    fit
                    disabled={!written || approvalProblems(problems).length > 0 || !data.sends}
                    pending={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      await saveNow();
                      // Back to the list, where the broadcast's row says it's waiting for WhatsApp, and pulses.
                      if ((await actions.submitTemplate(id)) === "submitted") {
                        router.push(`/staff/broadcasts?submitted=${id}`);
                      } else {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {copy.submitTemplate}
                  </Button>
                ) : (
                  <ScheduleButton
                    label={copy.schedule(data.count, draft.channel)}
                    disabled={problems.length > 0 || !data.sends}
                    saveNow={saveNow}
                    schedule={() => actions.schedule(id, version.current)}
                  />
                )}
                <DeleteDraft id={id} action={actions.deleteDraft} />
              </div>
              <ProblemList problems={shownProblems.map((problem) => copy.problems[problem])} />
            </Card>
          </>,
        )}
      </Grid>
    </>
  );
}
