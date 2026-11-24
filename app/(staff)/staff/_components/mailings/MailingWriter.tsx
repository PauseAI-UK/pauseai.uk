"use client";

import type { JSONContent } from "@tiptap/react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Controls";
import { Field, FieldError, Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { useLeaving } from "@/components/ui/useLeaving";
import { useSave } from "@/components/ui/useSave";
import {
  checkMailingDoc,
  conditionsIn,
  EMPTY_MAILING_DOC,
  GREETING_FIELDS,
  greetingLetter,
  isBlankMailing,
  letterFor,
  NOT_CONDITION,
  type MailingDoc,
} from "@/lib/mailings/doc";
import { answerLabels } from "@/lib/mailings/fields";
import StaffLink from "../ui/StaffLink";
import { DEFAULT_SENDER } from "@/lib/email/gmail-connect";
import { looksLikeEmail } from "@/lib/email-address";
import { named } from "@/lib/email-parsing/addresses";
import { leavePage } from "@/lib/leave-page.client";
import { scheduleProblems } from "@/lib/mailings/schedule";
import { alreadyAnswered } from "@/lib/mailings/warnings";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { filtersPath, pairedValue, type Params } from "@/lib/list-params";
import { INVITED, NEVER_ASKED } from "@/lib/asks/asks";
import { londonWhen } from "@/lib/staff-time";
import type { FormResult } from "@/lib/form-result";
import type { WrittenMailing } from "@/lib/mailings/drafts.server";
import type { PreviewRecipient, WriterData } from "@/lib/mailings/pages.server";
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
} from "./DraftWriter";
import { SentToday } from "../email/GmailConnect";
import { DeleteDraft } from "./MailingButtons";
import MailingEditor from "./MailingEditor";
import MailingFiles from "./MailingFiles";
import { MailingLetter } from "./MailingLetter";
import { BandFact, Facts } from "../ui/Band";
import Grid, { Card } from "../ui/Grid";
import Bubble from "@/components/ui/Bubble";
import NotIcon from "../ui/NotIcon";
import { partButton, partButtonWords } from "./PartBox";
import Strip from "../ui/Strip";
import Numbered from "../ui/Numbered";
import { helpButtonClass } from "../ui/HelpButton";
import { useTellPage } from "../ui/ResultForm";
import styles from "./MailingWriter.module.css";
import { mailingsCopy } from "./copy";
import { politiciansCopy } from "../politicians/copy";

const copy = mailingsCopy.mailingPages;
const facts = mailingsCopy.mailingPages.sendFacts;
const refusals = mailingsCopy.refusals;

/** What a mailing's page can change. */
type Changes = {
  subject: string;
  body: MailingDoc;
  ask: string | null;
  sentFrom: string | null;
  /** The name it's from; empty or null, the Gmail's own. */
  fromName: string | null;
  dueAt: Date | null;
};

/** The mailing pages' Server Actions (app/(staff)/staff/_components/mailings/actions.ts), which the page hands in. */
export type MailingWriterActions = DraftActions & {
  /** Sends a test copy, and says where it went: not for a draft that's gone, a politician no longer a recipient, or an email that couldn't be sent. */
  sendTest: (
    id: number,
    politicianId: number,
    to: string,
  ) => Promise<FormResult<"gone" | "not-recipient" | "not-sent", { to: string }>>;
  /** Schedules it: not as a save isn't, or for "problems", what the page checks too, changed since it loaded. */
  schedule: (id: number, version: number) => Promise<FormResult<SaveRefusal | "problems">>;
  /** Deletes it: not once someone has scheduled it. */
  deleteDraft: (form: FormData) => Promise<FormResult<"not-draft">>;
  /** Unticks these politicians for the draft: Leave them out, under a warning. Not for a draft that's gone, or no longer one. */
  leaveOut: (id: number, politicians: number[]) => Promise<FormResult<"gone">>;
};

/**
 * Something about who a mailing is to that may be a mistake, which can be
 * sent past: an amber strip of its words and, under them, Who they are,
 * which opens the list of who it's about below it, each linking to their
 * page, with a `detail` beside them if there's one; and beside it `action`,
 * a way to put it right, which stays put as the list opens.
 */
function Warning({
  words,
  who,
  action,
}: {
  words: string;
  who: { id: number; name: string; detail?: string }[];
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <Strip tone="amber">
      <div className={styles.warning}>
        <p>{words}</p>
        <div className={styles.whoRow}>
          <button
            type="button"
            className={styles.whoToggle}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true">{open ? "▾" : "▸"}</span> {copy.whoTheyAre}
          </button>
          {action}
        </div>
        <ul id={listId} className={styles.whoList} hidden={!open}>
          {who.map((one) => (
            <li key={one.id}>
              <a href={`/staff/politicians/${one.id}`}>{one.name}</a>
              {one.detail && <Muted> {one.detail}</Muted>}
            </li>
          ))}
        </ul>
      </div>
    </Strip>
  );
}

/** A "?" that opens a few words on what the thing beside it is for. */
function Help({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <Bubble id={id} label="?" trigger={helpButtonClass(styles.help)} name={label}>
      {children}
    </Bubble>
  );
}

/**
 * A draft mailing, on one page, in six numbered sections: who it's to, as
 * pills, with Change who, and who's left out; whose Gmail it's from, before
 * the writing, as the letters go in that person's voice; writing it, its
 * subject, ask, letter and files; a preview of each recipient's email, a
 * case at a time; when it goes, never in the past; and what will go,
 * with the button to schedule it, greyed with the reasons while anything
 * stops it. A draft with nothing written yet starts with a greeting, from
 * the policy team's Gmail, both saved with its first change. A draft saves
 * itself (useDraftWriter).
 */
export default function MailingWriter({
  data,
  draft,
  who,
  actions,
}: {
  data: WriterData;
  draft: WrittenMailing;
  /** Who it's to, as pills (FilterPills). */
  who: ReactNode;
  actions: MailingWriterActions;
}) {
  const letterLabel = useId();
  const askHelp = `ask-help-${useId().replace(/\W/g, "")}`;
  const askId = useId();
  const { id } = draft;
  const [start] = useState(() =>
    greetingLetter(
      copy.greeting,
      GREETING_FIELDS.find((field) => data.fields.some((f) => f.id === field && !f.lacking)),
    ),
  );
  // A draft with nothing written yet, as one is when it's made: its greeting and its Gmail are to be saved.
  const [fresh] = useState<Partial<Changes>>(() =>
    !draft.subject && isBlankMailing(draft.body)
      ? {
          body: start,
          // The policy team's Gmail, if it's connected, or else the first that is.
          sentFrom:
            draft.sentFrom ??
            (data.senders.find((one) => one.email === DEFAULT_SENDER) ?? data.senders[0])?.email ??
            null,
        }
      : {},
  );
  const {
    values,
    change,
    saveNow,
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
      ask: draft.ask,
      sentFrom: draft.sentFrom,
      fromName: draft.fromName || null,
      dueAt: draft.dueAt,
    },
    fresh,
    attachments: draft.attachments,
    actions,
  });
  // Change who, from its click while the draft's saved until the list comes.
  const [choosing, choose] = useLeaving();
  // The link to add an ask, likewise, until the ask's page comes.
  const [asking, goToAsk] = useLeaving();
  // Goes to another page once what's typed is saved, so going there loses none of it.
  const [leaveSaved] = useSave(async (href: string) => {
    await saveNow();
    leavePage(href);
  });
  // What a call to the server that threw answers: nothing on a page too old to ask, which the draft says (stale);
  // anything else is thrown on.
  const orOutdated = (error: unknown) => {
    if (stale(error)) return undefined;
    throw error;
  };
  // The draft's own page, which Connect Gmail and the Asks page come back to.
  const writerPath = `/staff/mailings/${id}`;
  const tell = useTellPage();
  // Leave them out, from when it's done until the draft comes again.
  const [leaving, leave] = useLeaving();
  // Unticks those a warning is about. What's typed is saved first; the draft then opens afresh, ticked for fewer, at
  // its new version. A draft that's gone, or no longer one, is said at the page's top, as the page catches up; a page
  // too old to ask, by the draft.
  const [leaveOut, leavingOut, notLeftOut] = useSave(
    async (ids: number[]) => {
      await saveNow();
      return actions.leaveOut(id, ids).catch(orOutdated);
    },
    {
      done: (result) => {
        if (result?.ok) {
          leave();
          leavePage(writerPath);
        } else if (result) tell(politiciansCopy.choosing.gone);
      },
    },
  );
  // Leave them out, for a warning about `ids`: both wait while either is done, as either changes who the draft's to.
  const leaveOutButton = (ids: number[]) => (
    <Button variant="ghost" size="small" fit pending={leavingOut || leaving} onClick={() => leaveOut(ids)}>
      {copy.leaveThemOut}
    </Button>
  );

  /** Whether a letter has nothing written in it yet: blank, or only the greeting it started with. */
  const unwritten = (letter: MailingDoc) => isBlankMailing(letter) || JSON.stringify(letter) === JSON.stringify(start);

  // The politicians list, choosing who it goes to: with no one ticked yet, those yet to answer its ask, if it
  // has one, those not answered and those never asked; then those ticked; or, for a draft from before ticks, its
  // filter.
  const yetToAnswer: Params = values.ask
    ? { ask: values.ask, answer: [INVITED, NEVER_ASKED].map((way) => pairedValue(values.ask!, way)) }
    : {};
  const whoPath = !data.filter.picked
    ? filtersPath("/staff/politicians", { ...data.filter.params, mailing: String(id) })
    : data.filter.picked.ids.length === 0
      ? filtersPath("/staff/politicians", { ...yetToAnswer, mailing: String(id) })
      : filtersPath("/staff/politicians", { mailing: String(id), tab: "ticked" });

  const body = useMemo(() => checkMailingDoc(values.body) ?? EMPTY_MAILING_DOC, [values.body]);
  // Before an hour's chosen, the day picked, or the first it can go, and no hour.
  const sender = data.senders.find((one) => one.email === values.sentFrom);
  const lacking = data.fields.filter((field) => field.lacking).map((field) => field.id);
  const written = !unwritten(body);
  const problems = scheduleProblems({
    ...values,
    // A letter of only its greeting is no letter.
    body: written ? body : EMPTY_MAILING_DOC,
    recipients: data.recipients.length,
    lacking,
    unknown: data.unknown,
    sends: data.sends,
    connected: Boolean(sender),
  }).filter((problem) => problem !== "cannot-send");
  const title = values.subject.trim() || politiciansCopy.choosing.newTitle;
  // The connected accounts, the policy team's first, and the one chosen if it isn't one any more.
  const senderChoices = [
    ...data.senders
      .toSorted((a, b) => Number(b.email === DEFAULT_SENDER) - Number(a.email === DEFAULT_SENDER))
      .map((one) => ({ ...one, connected: true })),
    ...(values.sentFrom && !sender ? [{ email: values.sentFrom, name: "", remaining: 0, connected: false }] : []),
  ];
  const noAddress = data.leftOut.filter((one) => one.reason === "no-address").length;
  // Those it goes to who've already answered its ask, which may be a mistake: a warning, not a problem.
  const ask = data.asks.find((one) => one.slug === values.ask);
  const answered = alreadyAnswered(data.recipients, ask);

  return (
    <>
      <DraftTitle title={title} saveState={saveState} />
      {!data.sends && <Strip tone="amber">{copy.cantSend}</Strip>}
      {saveState === "conflict" && (
        <Strip tone="red" announce>
          {copy.saveStates.conflict}
        </Strip>
      )}
      <Grid>
        {/* First, as what it asks shapes who it's to: Choose who starts from those yet to answer it. */}
        <Card span={6} title={<Numbered n={1}>{copy.ask}</Numbered>} id="ask-title">
          <div className={styles.ask}>
            <div className={styles.withHelp}>
              <Select
                id={askId}
                aria-label={copy.ask}
                value={values.ask ?? ""}
                onChange={(event) => change({ ask: event.target.value || null })}
              >
                <option value="">{copy.noAsk}</option>
                {data.asks.map((ask) => (
                  <option key={ask.slug} value={ask.slug}>
                    {ask.title}
                  </option>
                ))}
              </Select>
              <Help id={askHelp} label={copy.askHelpLabel}>
                {copy.askHelp}
              </Help>
            </div>
            <Hint>
              <a
                href={`/staff/asks/new?${new URLSearchParams({ back: writerPath })}`}
                data-pending={asking || undefined}
                onClick={(event) => {
                  event.preventDefault();
                  goToAsk();
                  leaveSaved(`/staff/asks/new?${new URLSearchParams({ back: writerPath })}`);
                }}
              >
                {copy.newAsk}
              </a>
            </Hint>
          </div>
        </Card>

        <Card span={6} title={<Numbered n={2}>{copy.sections.who}</Numbered>} id="who-title">
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
                leaveSaved(whoPath);
              }}
            >
              {data.filter.picked?.ids.length === 0 ? copy.chooseWho : copy.changeWho}
            </ButtonAnchor>
          </div>
          {data.unknown.length > 0 && <Strip tone="amber">{copy.unknownFilter(data.unknown.join(", "))}</Strip>}
          <p className={styles.count}>{copy.willGet(data.recipients.length)}</p>
          {/* What may be a mistake in who it's to, each an amber strip with who it's about under it. */}
          {data.leftOut.length > 0 && (
            <Warning
              words={copy.leftOut(noAddress, data.leftOut.length - noAddress, Boolean(data.filter.picked))}
              who={data.leftOut.map((one) => ({ ...one, detail: copy.leftOutReasons[one.reason] }))}
              action={leaveOutButton(data.leftOut.map((one) => one.id))}
            />
          )}
          {answered.who.length > 0 && (
            <Warning
              words={copy.alreadyAnswered(
                answered.who.length,
                ask!.title,
                answered.answers.map((one) =>
                  copy.alreadyAnsweredEach(one.count, staffVocabulary.statuses[one.status]),
                ),
                Boolean(data.filter.picked),
              )}
              who={answered.who.map((one) => ({ ...one, detail: staffVocabulary.statuses[one.status] }))}
              action={leaveOutButton(answered.who.map((one) => one.id))}
            />
          )}
          {/* Under the warnings: Leave them out threw, or never arrived. */}
          {notLeftOut && <FieldError announce="alert">{staffVocabulary.notDone}</FieldError>}
        </Card>

        <Card span={6} title={<Numbered n={3}>{copy.sections.from}</Numbered>} id="from-title">
          {/* The choice of connected Gmails, beside the name the mailing goes in, then what the chosen one has
              sent today, or that there's none; then, while yours isn't connected, where to connect it. */}
          <div className={styles.from}>
            {senderChoices.length > 0 ? (
              <>
                <div className={styles.fromFields}>
                  <Field label={copy.fromLegend} className={styles.sender}>
                    <Select
                      value={values.sentFrom ?? ""}
                      onChange={(event) => change({ sentFrom: event.target.value })}
                    >
                      {!values.sentFrom && (
                        <option value="" disabled>
                          {copy.choose}
                        </option>
                      )}
                      {senderChoices.map((sender) => (
                        <option key={sender.email} value={sender.email}>
                          {/* As a broadcast's: the address, and what sends from it. */}
                          {(sender.connected ? (address: string) => address : copy.senderNotConnected)(
                            mailingsCopy.mailingPages.fromOption(
                              sender.email,
                              mailingsCopy.mailingPages.sendBy.names.gmail,
                            ),
                          )}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {/* Until it's edited, the Gmail's own name, following the account chosen. Left empty, it's that name too. */}
                  <Field label={copy.fromNameLabel} className={styles.sender}>
                    <TextInput
                      value={values.fromName ?? sender?.name ?? ""}
                      onChange={(event) => change({ fromName: event.target.value })}
                      onBlur={() => values.fromName === "" && change({ fromName: null })}
                    />
                  </Field>
                </div>
                {sender && <SentToday sent={sender.sentToday} />}
              </>
            ) : (
              <p>{copy.noSenders}</p>
            )}
            {values.sentFrom && !sender && <Hint>{copy.notConnected}</Hint>}
            {/* Connecting is done on the account's own page, logged in as it. */}
            {!data.senders.some((one) => one.email === data.me) && (
              <p>
                <StaffLink href="/staff/me#gmail">{copy.connectOne}</StaffLink>
              </p>
            )}
          </div>
        </Card>

        <Card span={6} title={<Numbered n={4}>{copy.sections.write}</Numbered>} id="write-title">
          <Field label={copy.subject}>
            <TextInput value={values.subject} onChange={(event) => change({ subject: event.target.value })} />
          </Field>
          <div className={styles.letter}>
            <p id={letterLabel} className={styles.label}>
              {copy.letter}
            </p>
            {/* Made anew with what a reload kept, as it reads its words once. */}
            <MailingEditor
              key={restored}
              initial={values.body as JSONContent}
              onChange={(doc) => change({ body: doc as MailingDoc })}
              fields={data.fields}
              conditions={data.conditions}
              recipients={data.recipients.length}
              labelledBy={letterLabel}
            />
          </div>
          <div>
            <p className={styles.label}>{copy.attachments}</p>
            <MailingFiles
              files={attachments}
              base={`/staff/mailings/${id}/files`}
              onAdd={attach}
              onRemove={detach}
              problem={fileProblem}
            />
          </div>
        </Card>

        <Card span={6} title={<Numbered n={5}>{copy.sections.preview}</Numbered>} id="preview-title">
          <Preview
            data={data}
            body={body}
            subject={values.subject}
            sentFrom={values.sentFrom}
            fromName={values.fromName}
            needs={problems.filter((problem) => TEST_NEEDS.includes(problem)).map((problem) => copy.problems[problem])}
            sendTest={async (recipient, to) => {
              // The test is of the draft as saved, so what's typed goes first.
              await saveNow();
              return actions.sendTest(id, recipient, to).catch(orOutdated);
            }}
          />
        </Card>

        <Card span={6} title={<Numbered n={6}>{copy.sections.when}</Numbered>} id="when-title">
          <DueSection dueAt={values.dueAt} onChange={(dueAt) => change({ dueAt })} />
        </Card>

        <Card span={6} title={<Numbered n={7}>{copy.sections.send}</Numbered>} id="send-title">
          {/* As a broadcast's Send says what will go. */}
          <Facts>
            <BandFact label={facts.what}>{facts.count(data.recipients.length, "email")}</BandFact>
            {/* As the mailing's page has it: the address, the name under it. */}
            <BandFact label={facts.from} detail={values.sentFrom ? values.fromName || sender?.name : undefined}>
              {values.sentFrom ?? facts.noSender}
            </BandFact>
            {/* A mailing always goes by its account's Gmail. */}
            <BandFact label={facts.via}>{mailingsCopy.mailingPages.sendBy.names.gmail}</BandFact>
            <BandFact label={facts.when}>{values.dueAt ? londonWhen(values.dueAt, "short") : facts.noTime}</BandFact>
          </Facts>
          <div className={styles.send}>
            <ScheduleButton
              label={copy.schedule(data.recipients.length)}
              disabled={problems.length > 0 || !data.sends}
              saveNow={saveNow}
              schedule={async () => {
                const result = await actions.schedule(id, version.current);
                // One changed elsewhere since its last save says so, as a save refused does. A problem the page
                // checks too is under the button once the page, shown afresh, has what changed.
                if (!result.ok && result.reason !== "problems") conflicted();
                return result;
              }}
              stale={stale}
            />
            <DeleteDraft id={id} action={actions.deleteDraft} says={refusals.deleteDraft} atTop={["not-draft"]} />
          </div>
          <ProblemList problems={problems.map((problem) => copy.problems[problem])} />
          {!data.sends && <Strip tone="amber">{copy.cantSend}</Strip>}
        </Card>
      </Grid>
    </>
  );
}

/**
 * Each recipient's email, as they'll get it. Over it, a button for each
 * condition the letter's parts use, pressed for those who meet it, unpressed
 * for those who don't, each press choosing the first recipient with the
 * answers pressed; then the choice of every recipient, which sets the
 * buttons to theirs. With no one with the answers pressed, no email, as
 * there's no one to fill it in for. Under it, a test copy, sent to
 * yourself, once it has a subject and a letter.
 */
function Preview({
  data,
  body,
  subject,
  sentFrom,
  fromName,
  needs,
  sendTest,
}: {
  data: WriterData;
  body: MailingDoc;
  subject: string;
  sentFrom: string | null;
  fromName: string | null;
  /** What it still needs before there's something to test, as the Send section says it. */
  needs: string[];
  /** Sends the test copy of a recipient's email; answers nothing on a page too old to ask, which the draft says. */
  sendTest: (
    recipient: number,
    to: string,
  ) => Promise<Awaited<ReturnType<MailingWriterActions["sendTest"]>> | undefined>;
}) {
  const tell = useTellPage();
  // Where the test copy goes: you, unless you give another address.
  const [testTo, setTestTo] = useState(data.me);
  const testToId = useId();
  // As its From line will show it: in the name chosen, or the Gmail's own, if it has one.
  const fromLine = named(fromName || data.senders.find((sender) => sender.email === sentFrom)?.name, sentFrom!);
  const findLabel = useId();
  const [chosen, setChosen] = useState(data.recipients[0]?.id);
  // The answers pressed, since someone was last chosen; else theirs.
  const [wanted, setWanted] = useState<Record<string, boolean>>({});
  // How the last test copy went, as the line under the button says it, and whether it went.
  const [sent, setSent] = useState<{ line: string; went: boolean }>();
  const [send, sending, broke] = useSave(sendTest, {
    done: (result) => {
      if (result?.ok) setSent({ line: copy.testSent(result.to), went: true });
      // The draft's gone, and the button with it as the page catches up.
      else if (result?.reason === "gone") tell(refusals.test.gone);
      else setSent({ line: result ? refusals.test[result.reason] : copy.testFailed, went: false });
    },
  });
  // A send that threw, or never arrived, reads as one that couldn't be sent.
  const test = broke ? { line: copy.testFailed, went: false } : sent;
  const first = data.recipients[0];
  if (!first) return <p>{copy.noOne}</p>;
  const shown = data.recipients.find((r) => r.id === chosen) ?? first;
  const used = [
    ...new Set(conditionsIn(body).map((c) => (c.startsWith(NOT_CONDITION) ? c.slice(NOT_CONDITION.length) : c))),
  ];
  const meets = Object.fromEntries(used.map((c) => [c, wanted[c] ?? shown.meets.includes(c)]));
  const fits = (r: PreviewRecipient, answers: Record<string, boolean>) =>
    used.every((c) => r.meets.includes(c) === answers[c]);
  const recipient = fits(shown, meets) ? shown : undefined;
  const labels = answerLabels(data.asks);
  const toggle = (condition: string) => {
    const answers = { ...meets, [condition]: !meets[condition] };
    setWanted(answers);
    const match = data.recipients.find((r) => fits(r, answers));
    if (match) setChosen(match.id);
    setSent(undefined);
  };
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
      <Field label={copy.chooseRecipient} className={styles.whoShown}>
        <Select
          value={recipient?.id ?? ""}
          onChange={(event) => {
            setChosen(Number(event.target.value));
            setWanted({});
            setSent(undefined);
          }}
        >
          {!recipient && <option value="" disabled />}
          {data.recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.constituency ? `${r.name} · ${r.constituency}` : r.name}
            </option>
          ))}
        </Select>
      </Field>
      {recipient ? (
        <div className={styles.email}>
          <dl className={styles.headers}>
            <dt>{copy.from}</dt>
            <dd>{sentFrom ? fromLine : <Muted>{copy.noSender}</Muted>}</dd>
            <dt>{copy.to}</dt>
            <dd>{`${recipient.name} <${recipient.email}>`}</dd>
            <dt>{copy.subject}</dt>
            <dd>
              <strong>{subject}</strong>
            </dd>
          </dl>
          <MailingLetter doc={letterFor(body, recipient)} />
        </div>
      ) : (
        // No one to fill it in for: no email, rather than one made up.
        <p className={styles.noEmail}>{copy.noOneMix}</p>
      )}
      <div className={styles.test}>
        <div className={styles.testRow}>
          <label htmlFor={testToId} className={styles.testLabel}>
            {copy.sendTestTo}
          </label>
          <span className={styles.testTo}>
            <TextInput id={testToId} type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
          </span>
          <Button
            variant="primary"
            fit
            disabled={needs.length > 0 || !recipient || !looksLikeEmail(testTo.trim())}
            pending={sending}
            onClick={() => send(recipient!.id, testTo.trim())}
          >
            {copy.sendTest}
          </Button>
        </div>
        <Muted>{copy.testVia(data.senders.some((sender) => sender.email === sentFrom) ? sentFrom : null)}</Muted>
        <TestSent line={test?.line} sent={Boolean(test?.went)} />
        <ProblemList problems={needs} />
      </div>
    </>
  );
}
