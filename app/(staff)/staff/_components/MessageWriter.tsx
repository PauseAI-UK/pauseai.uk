"use client";

import type { JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { useLeaving } from "@/components/ui/useLeaving";
import { staffCopy } from "@/lib/content/staff-interface";
import { looksLikeEmail } from "@/lib/email-your-mp";
import { leavePage } from "@/lib/leave-page";
import { toText } from "@/lib/letter-format";
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
import type { MessageScheduleResult, MessageTemplate, WrittenMessage } from "@/lib/server/message-drafts";
import type { MessagePreviewRecipient, MessageWriterData } from "@/lib/server/message-pages";
import { filtersPath } from "@/lib/staff-search";
import { earliestHour, fromLondon, londonClock, londonDayHour, londonWhen, sendsAt, staffTime } from "@/lib/staff-time";
import { stateValue, type Channel } from "@/lib/contact-permissions";
import {
  hasField,
  hasWords,
  MESSAGE_START,
  messageCost,
  messageScheduleProblems,
  MESSAGE_SENDER,
  spacedNumber,
  textStopsAt,
  TEXT_SENDER_NAME,
} from "@/lib/supporter-messages";
import { DraftTitle, Numbered, useDraftWriter, type DraftActions } from "./DraftWriter";
import { DueTimeFields } from "./DueTime";
import { SentToday } from "./GmailConnect";
import { DeleteDraft } from "./MailingButtons";
import MailingEditor from "./MailingEditor";
import MailingFiles from "./MailingFiles";
import MessageConsent from "./MessageConsent";
import { MailingLetter } from "./MailingLetter";
import TemplatePicker, { templateLine } from "./TemplatePicker";
import TextBubble from "./TextBubble";
import Grid, { Card } from "./ui/Grid";
import NotIcon from "./ui/NotIcon";
import Strip from "./ui/Strip";
import { ButtonTabs } from "./ui/Tabs";
import styles from "./MailingWriter.module.css";
import own from "./Messages.module.css";

const copy = staffCopy.messagePages;

/** What a message's page can change. */
type Changes = {
  subject: string;
  body: MailingDoc;
  sentFrom: string | null;
  fromName: string | null;
  dueAt: string | null;
  templateId: number | null;
};

/** The message pages' Server Actions (app/(staff)/staff/message-actions.ts), which the page hands in. */
export type MessageWriterActions = DraftActions & {
  sendTest: (id: number, supporterId: number, to: string) => Promise<(ChannelResult & { to: string }) | undefined>;
  schedule: (id: number, version: number) => Promise<MessageScheduleResult>;
  deleteDraft: (form: FormData) => void | Promise<void>;
  /** Changes the Consent a draft goes under; says whether it did. */
  changeConsent: (id: number, consent: string) => Promise<boolean>;
  /** Makes a draft under a Consent, from New broadcast, and opens it. */
  create: (consent: string) => Promise<void>;
};

/** How a draft's words stand: an email's own, or a text's template chosen, new words, or none yet. */
type Words = "email" | "chosen" | "new" | "none";

/**
 * A text's template, chosen, under the list it was chosen from: its full
 * words, which can't be edited, and who made it.
 */
function TemplateChosen({ template }: { template: MessageTemplate }) {
  const fields = Object.fromEntries(Object.entries(copy.fieldWords));
  return (
    <div className={styles.letter}>
      <div className={own.chosen}>
        <strong>{template.name}</strong>
        <MailingLetter doc={template.body} fields={fields} />
        <Muted>
          {templateLine(template)}. {copy.templateFixed}
        </Muted>
      </div>
    </div>
  );
}

/**
 * Each recipient's copy, as they'll get it: an email as a mail app shows
 * it, or a text as a bubble. Over it, a button for each field the words use
 * and each condition of their parts, pressed for those who have or meet it,
 * each press choosing a recipient like that. With no one like that, no
 * copy, as there's no one to fill it in for. Under it, a test copy.
 */
function MessagePreview({
  data,
  draft,
  body,
  words,
  subject,
  from,
  gmail,
  written,
  dueAt,
  sendTest,
}: {
  data: MessageWriterData;
  draft: WrittenMessage;
  body: MailingDoc;
  words: Words;
  subject: string;
  from: string;
  /** The connected Gmail an email goes from, which its test goes from too; none for Postmark. */
  gmail: string | null;
  written: boolean;
  dueAt: string | null;
  sendTest: (recipient: number, to: string) => ReturnType<MessageWriterActions["sendTest"]>;
}) {
  const email = draft.channel === "email";
  const testId = useId();
  const findLabel = useId();
  const [testTo, setTestTo] = useState(email ? data.me : "");
  const [chosen, setChosen] = useState(data.recipients[0]?.id);
  const [wanted, setWanted] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<{ to?: string } | undefined>();
  const [sending, setSending] = useState(false);
  if (words === "none") return <p className={styles.noEmail}>{copy.chooseTemplate}</p>;
  const first = data.recipients[0];
  if (!first) return <p>{copy.noOne}</p>;
  const shown = data.recipients.find((r) => r.id === chosen) ?? first;
  const used = [
    ...new Set([
      ...fieldsIn(body).map(hasField),
      ...conditionsIn(body).map((c) => (c.startsWith(NOT_CONDITION) ? c.slice(NOT_CONDITION.length) : c)),
    ]),
  ];
  const meets = Object.fromEntries(used.map((c) => [c, wanted[c] ?? shown.meets.includes(c)]));
  const fits = (r: MessagePreviewRecipient, answers: Record<string, boolean>) =>
    used.every((c) => r.meets.includes(c) === answers[c]);
  const recipient = fits(shown, meets) ? shown : undefined;
  const labels: Record<string, string> = {
    [hasField("firstName")]: copy.hasFirstName,
    ...Object.fromEntries(data.conditions.map((condition) => [condition.id, condition.label])),
  };
  const toggle = (condition: string) => {
    const answers = { ...meets, [condition]: !meets[condition] };
    setWanted(answers);
    const match = data.recipients.find((r) => fits(r, answers));
    if (match) setChosen(match.id);
    setSent(undefined);
  };
  const canTest = email ? written && looksLikeEmail(testTo.trim()) : words === "chosen" && data.sends && testTo.trim();
  const testNote = email
    ? gmail
      ? copy.testVia.emailGmail(gmail)
      : copy.testVia.email
    : !data.sends
      ? copy.testVia.textOff
      : words === "chosen"
        ? copy.testVia.text
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
      {recipient ? (
        <>
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
              text={toText(letterFor(body, recipient))}
              time={londonClock(sendsAt(dueAt ?? earliestHour()))}
            />
          )}
        </>
      ) : (
        <p className={styles.noEmail}>{copy.noOneMix}</p>
      )}
      {!email && <Hint>{copy.howToStop}</Hint>}
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
            disabled={!canTest || !recipient}
            pending={sending}
            onClick={async () => {
              setSending(true);
              const result = await sendTest(recipient!.id, testTo.trim());
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
      </div>
    </>
  );
}

/**
 * A draft message to supporters, by email or text, on one page, in six
 * numbered sections: who it's to, what they said yes to apart from the
 * other filters' pills, with Change who, and who's left out; writing it, an email's subject, words and files, or a text's template;
 * a preview of each recipient's copy; who it appears from; when it goes,
 * and for a text when it stops; and what will go and cost, with the button to
 * schedule it, greyed with the reasons while anything stops it.
 */
export default function MessageWriter({
  data,
  draft,
  who,
  blank = false,
  chosen = "",
  onChannel,
  actions,
}: {
  data: MessageWriterData;
  draft: WrittenMessage;
  /** Who else it's to, as pills (MessageWho). */
  who: ReactNode;
  /** New broadcast, before its Consent is chosen: no draft yet, everything but the Consent greyed and still. */
  blank?: boolean;
  /** On New broadcast, the channel already picked, and what's told when one is (NewMessageWriter). */
  chosen?: Channel | "";
  onChannel?: (channel: Channel) => void;
  actions: MessageWriterActions;
}) {
  const router = useRouter();
  const label = useId();
  const email = draft.channel === "email";
  const { id } = draft;
  const start = MESSAGE_START;
  const [picking, setPicking] = useState(false);
  // The channel whose Consents show: the draft's, or on New broadcast the one picked, if any.
  const [shown, setShown] = useState<Channel | "">(blank ? chosen : email ? "email" : "phone");
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
      },
      fresh,
      attachments: draft.attachments,
      actions,
    });
  const [choosing, choose] = useLeaving();
  const [scheduling, setScheduling] = useState(false);
  const [dayPicked, setDayPicked] = useState("");
  // A text's words: an approved template's, or new ones, a tab each. New words
  // are kept while the other tab is open, so going back finds them.
  const [writingNew, setWritingNew] = useState(
    () => !email && !isBlankMailing(draft.body) && draft.template?.status !== "approved",
  );
  const newWords = useRef<MailingDoc>(EMPTY_MAILING_DOC);
  const tabsId = useId();
  const body = useMemo(() => checkMailingDoc(values.body) ?? EMPTY_MAILING_DOC, [values.body]);
  const template = data.templates.find((one) => one.id === values.templateId);
  const words: Words = email ? "email" : writingNew ? "new" : template ? "chosen" : "none";
  const written = email
    ? !isBlankMailing(body) && JSON.stringify(body) !== JSON.stringify(start)
    : !isBlankMailing(body);
  const earliest = londonDayHour(earliestHour());
  const when = values.dueAt ? londonDayHour(values.dueAt) : { day: dayPicked || earliest.day, hour: null };
  const sender = data.senders.find((one) => one.email === values.sentFrom);
  const byGmail = email && values.sentFrom !== MESSAGE_SENDER.email;
  const problems = messageScheduleProblems({
    channel: draft.channel,
    subject: values.subject,
    body: written ? body : EMPTY_MAILING_DOC,
    dueAt: values.dueAt,
    recipients: data.count,
    unknown: data.unknown,
    byGmail,
    connected: Boolean(sender),
    sends: data.sends,
  }).filter((problem) => problem !== "cannot-send");
  const fromName = email ? values.fromName || (byGmail ? sender?.name : MESSAGE_SENDER.name) : TEXT_SENDER_NAME;
  const fromLine = email ? named(fromName, values.sentFrom!) : TEXT_SENDER_NAME;
  const title = email
    ? values.subject.trim() || copy.newTitle.email
    : (template?.name ?? (draft.title || copy.newTitle.text));
  const whoPath = filtersPath("/staff/supporters", { ...data.filter.params, message: String(id) });
  const hasOwnWords = hasWords({ subject: values.subject, body, templateId: values.templateId });
  // Choosing a Consent: on New broadcast, makes the draft; on a draft, saves what's typed, then changes it.
  const pickConsent = async (consent: string) => {
    setPicking(true);
    try {
      if (blank) return await actions.create(consent);
      await saveNow();
      if (await actions.changeConsent(id, consent)) router.refresh();
    } finally {
      setPicking(false);
    }
  };
  // On New broadcast, what's still to come: there, but greyed and out of reach.
  const lockable = (children: ReactNode) =>
    blank ? (
      <div inert className={own.locked}>
        {children}
      </div>
    ) : (
      children
    );
  const leftOutCounts = (["no-permission", "stopped", "blocked"] as const).flatMap((reason) => {
    const n = data.leftOut.filter((one) => one.reason === reason).length;
    return n ? [{ reason: copy.leftOutCounted[reason], n }] : [];
  });
  const showTab = (key: string) => {
    if ((key === "new") === writingNew) return;
    if (key === "new") {
      change({ templateId: null, body: newWords.current });
    } else {
      newWords.current = body;
      change({ templateId: null, body: EMPTY_MAILING_DOC });
    }
    setWritingNew(key === "new");
  };
  const wordsEditor = (labelledBy: string) => (
    <MailingEditor
      initial={values.body as JSONContent}
      onChange={(doc) => change({ body: doc as MailingDoc })}
      fields={data.fields}
      conditions={data.conditions}
      noParts={!email}
      recipients={data.count}
      labelledBy={labelledBy}
    />
  );
  const wordsTabs = [
    { key: "approved", label: copy.templatesLabel, id: `${tabsId}-approved` },
    { key: "new", label: copy.newTemplate, id: `${tabsId}-new` },
  ];
  return (
    <>
      <DraftTitle title={title} saveState={blank ? undefined : saveState} />
      {!data.sends && <Strip tone="amber">{copy.cantSend}</Strip>}
      {saveState === "conflict" && (
        <Strip tone="red" announce>
          {staffCopy.mailingPages.saveStates.conflict}
        </Strip>
      )}
      {draft.template?.status === "rejected" && (
        <Strip tone="red">{copy.rejected(staffTime(draft.template.rejectedAt!), draft.template.rejectedReason!)}</Strip>
      )}
      <Grid>
        <Card span={6} title={<Numbered n={1}>{copy.sections.who}</Numbered>} id="who-title">
          <MessageConsent
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
              <p className={styles.count}>{copy.willGet(data.count, draft.channel)}</p>
              {data.leftOut.length > 0 && (
                <details className={styles.leftOut}>
                  <summary>{copy.leftOut(data.count + data.leftOut.length, leftOutCounts)}</summary>
                  <ul>
                    {data.leftOut.map((one) => (
                      <li key={one.id}>
                        <a href={`/staff/supporters/${one.id}`}>{one.name}</a>{" "}
                        <Muted>{copy.leftOutReasons[one.reason]}</Muted>
                      </li>
                    ))}
                  </ul>
                </details>
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
                    <Field label={copy.fromAccount} className={styles.sender}>
                      <Select value={values.sentFrom!} onChange={(event) => change({ sentFrom: event.target.value })}>
                        {/* Each address with what sends from it: ours by Postmark, a staff member's by their Gmail. */}
                        <option value={MESSAGE_SENDER.email}>
                          {copy.fromOption(MESSAGE_SENDER.email, "Postmark")}
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
                    <Muted>{data.textNumber ? spacedNumber(data.textNumber) : copy.noNumber}</Muted>
                    <br />
                    <Muted>{copy.textFromNote}</Muted>
                  </p>
                </div>
              )}
            </Card>

            <Card span={6} title={<Numbered n={3}>{copy.sections.write}</Numbered>} id="write-title">
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
                <div>
                  <ButtonTabs
                    label={copy.sections.write}
                    tabs={wordsTabs}
                    current={writingNew ? "new" : "approved"}
                    onChoose={showTab}
                  />
                  <div role="tabpanel" aria-labelledby={wordsTabs[writingNew ? 1 : 0].id} className={styles.letter}>
                    {!writingNew && (
                      <TemplatePicker
                        templates={data.templates}
                        chosen={template?.id}
                        onChoose={(one) => change({ templateId: one.id, body: one.body })}
                      />
                    )}
                    {template && <TemplateChosen template={template} />}
                    {writingNew && (
                      <>
                        {wordsEditor(wordsTabs[1].id)}
                        <Hint>{copy.newTemplateHint}</Hint>
                      </>
                    )}
                  </div>
                </div>
              )}
              {email && (
                <div>
                  <p className={styles.label}>{copy.files}</p>
                  <MailingFiles
                    files={attachments}
                    base={`/staff/messages/${id}/files`}
                    onAdd={attach}
                    onRemove={detach}
                    problem={fileProblem}
                  />
                </div>
              )}
            </Card>

            <Card span={6} title={<Numbered n={4}>{copy.sections.preview}</Numbered>} id="preview-title">
              <MessagePreview
                data={data}
                draft={draft}
                body={body}
                words={words}
                subject={values.subject}
                from={fromLine}
                gmail={byGmail && sender ? sender.email : null}
                written={written}
                dueAt={values.dueAt}
                sendTest={async (recipient, to) => {
                  // The test is of the draft as saved, so what's typed goes first.
                  await saveNow();
                  return actions.sendTest(id, recipient, to);
                }}
              />
            </Card>

            <Card span={6} title={<Numbered n={5}>{copy.sections.when}</Numbered>} id="when-title">
              <div className={styles.when}>
                <DueTimeFields
                  day={when.day}
                  hour={when.hour}
                  dayClass={styles.day}
                  hourClass={styles.hour}
                  onChange={(day, hour) => {
                    setDayPicked(day);
                    if (hour !== null) change({ dueAt: fromLondon(day, hour) });
                  }}
                />
              </div>
              {!email && values.dueAt && (
                <p>
                  <Muted>{copy.stopsOn(londonWhen(textStopsAt(values.dueAt), "short"))}</Muted>
                </p>
              )}
            </Card>

            <Card span={6} title={<Numbered n={6}>{copy.sections.send}</Numbered>} id="send-title">
              <p className={styles.count}>
                {copy.summary(data.count, draft.channel, fromLine, values.dueAt ? londonWhen(values.dueAt) : null)}{" "}
                {messageCost(draft.channel, data.count)}
              </p>
              {words === "new" && <p>{copy.mustApprove}</p>}
              <div className={styles.send}>
                <Button
                  variant="primary"
                  fit
                  disabled={problems.length > 0 || !data.sends}
                  pending={scheduling}
                  onClick={async () => {
                    setScheduling(true);
                    // What's still to be saved, such as a time just chosen, goes first, or it's scheduled without it.
                    await saveNow();
                    const result = await actions.schedule(id, version.current);
                    // The page becomes the scheduled message's, from its top; till then the button stays pending.
                    if (result.scheduled) {
                      window.scrollTo({ top: 0, behavior: "instant" });
                      router.refresh();
                    } else {
                      setScheduling(false);
                    }
                  }}
                >
                  {words === "new" ? copy.scheduleOnceApproved(data.count) : copy.schedule(data.count, draft.channel)}
                </Button>
                <DeleteDraft id={id} action={actions.deleteDraft} />
              </div>
              {problems.length > 0 && (
                <ul className={styles.problems}>
                  {problems.map((problem) => (
                    <li key={problem}>{copy.problems[problem]}</li>
                  ))}
                </ul>
              )}
            </Card>
          </>,
        )}
      </Grid>
    </>
  );
}
