import StaffLink from "../ui/StaffLink";
import type { ReactNode } from "react";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { asksAgreed } from "@/lib/asks/asks";
import type { Ask } from "@/lib/asks/records";
import { AskTitle } from "../asks/AskLine";
import { PoliticianAsks } from "./AskRow";
import CampaignName from "../CampaignName";
import { FieldChanges } from "../AuditDetail";
import type { FieldChange } from "@/lib/field-changes";
import type { EmailBlock } from "@/lib/server/email";
import type { OneOffThreadRow } from "@/lib/server/one-off-emails";
import type { LetterSummary, PauseaiLetter, PoliticianLetters, UnsignedLetter } from "@/lib/server/letters";
import type { Politician, PoliticianChange } from "@/lib/politicians/records";
import { correspondenceThreads, hasReply, type ThreadMessages } from "@/lib/politicians/threads";
import { staffDate, staffTime } from "@/lib/staff-time";
import styles from "../Details.module.css";
import Band, { BandFact } from "../ui/Band";
import Counts, { type Count } from "../ui/Counts";
import Empty from "../ui/Empty";
import Grid, { Card, Column } from "../ui/Grid";
import Strip from "../ui/Strip";
import Tabs from "../ui/Tabs";
import Withheld from "../ui/Withheld";
import { NationShape, Rosette, StatusDot } from "./PoliticianIcons";
import UnblockForm from "../UnblockForm";
import NotesCard from "../NotesCard";
import { NoteEntry, type NotesProps } from "../Notes";
import PoliticianCorrespondence from "./PoliticianCorrespondence";
import { statusOf } from "../LetterStatus";
import { Muted } from "@/components/ui/Text";
import ExternalLink from "../ui/ExternalLink";
import type { PoliticianAliases } from "@/lib/politicians/aliases";
import PoliticianMarks from "./PoliticianMarks";
import { AddressesBubble, SalutationBubble, type AliasActions } from "./PoliticianWriting";
import { bodyOf, officialProfile } from "@/lib/politicians/official-profiles";
import type { EditResult } from "@/lib/politicians/edits";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician;

/** One line of the history: when, to the minute or, with `day`, only the day, and what, already in words. */
type Entry = { key: string; at: Date; day?: boolean; what: ReactNode };

/**
 * When an entry of the audit log happened: an answer dated before it was
 * recorded, as those an import finds already there are, on that day; anything
 * else when it was logged.
 */
function whenOf(change: PoliticianChange): { at: Date; day: boolean } {
  const date = change.action === "set status" && typeof change.details.date === "string" ? change.details.date : "";
  return date && date < change.at.toISOString().slice(0, 10)
    ? { at: new Date(date), day: true }
    : { at: change.at, day: false };
}

/** A letter: who wrote it, linked to their supporter once they're one, the campaign, and how it ended. */
function Sender({ letter }: { letter: LetterSummary }) {
  return (
    <>
      {letter.supporterId === null ? (
        letter.senderName
      ) : (
        <StaffLink href={`/staff/supporters/${letter.supporterId}`}>{letter.senderName}</StaffLink>
      )}
      <Muted>
        {" · "}
        <CampaignName slug={letter.campaign} title={letter.campaignTitle} />
      </Muted>
    </>
  );
}

/** A letter without its sender: its campaign, and how it ended, as words, not a link to the letter. */
function Unsigned({ letter, status }: { letter: UnsignedLetter; status: boolean }) {
  return (
    <Muted>
      {" · "}
      <CampaignName slug={letter.campaign} title={letter.campaignTitle} linked={false} />
      {status && <> · {statusOf(letter.status)}</>}
    </Muted>
  );
}

/**
 * The letters as history: each written, and each answered, as its own
 * line. With their senders, each names who wrote it, its status, and a link to
 * the letter's page; without, only the campaign and the status.
 */
function letterEntries({ senders, letters }: PoliticianLetters): Entry[] {
  const lines = (letter: LetterSummary | UnsignedLetter, written: ReactNode, replied: ReactNode): Entry[] => [
    { key: `letter-${letter.id}`, at: letter.createdAt, what: written },
    ...(letter.repliedAt ? [{ key: `replied-${letter.id}`, at: letter.repliedAt, what: replied }] : []),
  ];
  if (!senders) {
    return letters.flatMap((letter) =>
      lines(
        letter,
        <>
          <Withheld>{copy.history.unsignedLetter}</Withheld>
          <Unsigned letter={letter} status />
        </>,
        <>
          <Withheld>{copy.history["unsigned-letter-replied"]}</Withheld>
          <Unsigned letter={letter} status={false} />
        </>,
      ),
    );
  }
  return letters.flatMap((letter) =>
    lines(
      letter,
      <>
        {copy.history.letter} <Sender letter={letter} />
        <Muted>
          {" · "}
          {statusOf(letter.status)}
          {" · "}
          <StaffLink href={`/staff/letters/${letter.id}`}>{staffCopy.mailingPages.theLetter}</StaffLink>
        </Muted>
      </>,
      <>
        {copy.history["letter-replied"]} <Sender letter={letter} />
        <Muted>
          {" · "}
          <StaffLink href={`/staff/letters/${letter.id}`}>{staffCopy.mailingPages.theLetter}</StaffLink>
        </Muted>
      </>,
    ),
  );
}

/**
 * PauseAI's letters, each a line: the mailing, whether it was personalised,
 * how it stands, and a link to the letter's page under its mailing.
 */
function pauseaiEntries(letters: PauseaiLetter[]): Entry[] {
  return letters.map((letter) => ({
    key: `pauseai-${letter.id}`,
    at: letter.at,
    what: (
      <>
        {copy.history["pauseai-letter"]}{" "}
        <StaffLink href={`/staff/mailings/${letter.mailingId}`}>{letter.mailing}</StaffLink>
        <Muted>
          {letter.personalised && ` · ${copy.personalised}`}
          {" · "}
          {statusOf(letter.status)}
          {" · "}
          <StaffLink href={`/staff/mailings/${letter.mailingId}/letters/${letter.id}`}>
            {staffCopy.mailingPages.theLetter}
          </StaffLink>
        </Muted>
      </>
    ),
  }));
}

/** Stands in for the answer in the copy's words, to put the answer's link there. */
const ANSWER = "\u0000";

/**
 * What an entry of the audit log about them says, beyond its kind: the
 * status, the note, the reason. An answer leads to everyone who gave it to
 * that ask, and the ask to the letter or event; a blocked address, to
 * Addresses to fix, searched for it.
 */
function Detail({ change, asks }: { change: PoliticianChange; asks: Ask[] }) {
  const { details } = change;
  const text = (key: string) => (typeof details[key] === "string" ? (details[key] as string) : "");
  switch (change.action) {
    case "set status": {
      const ask = asks.find((a) => a.slug === details.ask);
      const label = staffVocabulary.statuses[text("status")] ?? text("status");
      const words = details.status === null ? copy.statusCleared : copy.statusSet(ANSWER);
      const [lead, rest = ""] = words.before.split(ANSWER);
      return (
        <>
          {lead}
          {words.before.includes(ANSWER) && label}
          {rest}
          {/* Logged by ask, or, before asks, by campaign. The ask leads where it does in the asks card. */}
          {ask ? <AskTitle ask={ask} /> : details.ask ? text("ask") : <CampaignName slug={text("campaign")} />}
          {words.after}
          {text("note") && <Muted> · {text("note")}</Muted>}
        </>
      );
    }
    case "add politician":
    case "edit politician":
      return (
        <>
          {text("name")}
          {details.changed ? (
            <>
              <Muted> · </Muted>
              <FieldChanges changed={details.changed as Record<string, FieldChange>} />
            </>
          ) : (
            text("email") && <Muted> · {text("email")}</Muted>
          )}
        </>
      );
    case "block address":
    case "unblock address": {
      const kind = staffCopy.emails.kinds[text("kind")] ?? text("kind");
      // An unblock has a note, and a block the kind of problem.
      return (
        <>
          <StaffLink href={`/staff/politicians/addresses-to-fix?q=${encodeURIComponent(text("address"))}`}>
            {text("address")}
          </StaffLink>
          <Muted> · {kind || text("note")}</Muted>
        </>
      );
    }
    default:
      return <>{text("note")}</>;
  }
}

/**
 * The band at the top of their page: their name, and under it what they are; at its
 * top right, quietly, where their record came from, linked to their page on
 * their body's site; then their party, whether they're in office, their nation
 * and how to write to them; and how many asks they agreed to (asksAgreed),
 * then roughly how many emails went each way, when any did, each leading to
 * Correspondence.
 */
function PoliticianBand({
  politician,
  emailCounts,
  email,
  salutation,
}: {
  politician: Politician;
  emailCounts: Count[];
  /** Their email, with its bubble of their other addresses where staff can change them. */
  email: ReactNode;
  /** Their salutation, quietly under their email, with its bubble to change it. */
  salutation: ReactNode;
}) {
  const inOffice = politician.status === "in_office";
  const body = bodyOf(politician.house);
  const profile = officialProfile(politician);
  const source = politician.isTest
    ? copy.sources.test
    : profile && body
      ? copy.sources[body]
      : politician.airtableId
        ? copy.sources.airtable
        : copy.sources.staff;
  return (
    <Band
      className={styles.band}
      title={politician.name}
      subtitle={copy.role(copy.roles[politician.house], politician.constituency, inOffice)}
      corner={
        <>
          {copy.source} {profile ? <ExternalLink href={profile}>{source}</ExternalLink> : source}
        </>
      }
      aside={
        <Counts
          counts={[
            // First, as it matters most, and as the politicians list's columns have it.
            {
              key: "asks",
              n: asksAgreed(politician.statuses),
              label: copy.band.asksAgreed(asksAgreed(politician.statuses)),
              // Good news, so green, as an answered letter's count is; none stays grey.
              tone: "green",
              href: `/staff/politicians/${politician.id}#asks-title`,
            },
            ...emailCounts,
          ]}
        />
      }
    >
      <BandFact label={staffVocabulary.fields.party}>
        {politician.party && (
          <span className={styles.withIcon}>
            <Rosette party={politician.party} />
            {politician.party}
          </span>
        )}
      </BandFact>
      <BandFact label={copy.status}>
        <span className={styles.withIcon}>
          <StatusDot inOffice={inOffice} />
          {staffVocabulary.personStatuses[politician.status]}
        </span>
      </BandFact>
      <BandFact label={copy.country}>
        {politician.country && (
          <span className={styles.withIcon}>
            <NationShape country={politician.country} />
            {staffVocabulary.countries[politician.country]}
          </span>
        )}
      </BandFact>
      <BandFact label={staffVocabulary.fields.email} detail={salutation}>
        {email}
      </BandFact>
    </Band>
  );
}

/** Whether staff keep their email: a Lord's, as most Lords list none of their own. */
const ownEmail = (politician: Politician) => politician.house === "lords";

const NO_MESSAGES: ThreadMessages = { subjects: {}, letters: {}, oneOffs: {} };

/**
 * A politician's page, laid out like a supporter's: the band of who they
 * are (PoliticianBand); if their address is blocked, why, and a way to
 * unblock it; then their correspondence (PoliticianCorrespondence); and
 * beside it the card of their answer to each ask, with the button to change
 * one staff record, the card of staff's notes (NotesCard), Airtable's among
 * them, and the card of the marks on them (PoliticianMarks). Under those, folded as a
 * supporter's are, their history, newest first: the letters written to them,
 * the replies, PauseAI's emails, one-off threads, staff's notes and their
 * answers, the letters' senders only when it's given them; then what changed
 * their record.
 */
export default function PoliticianDetails({
  politician,
  asks,
  setStatus,
  block,
  unblock,
  letters,
  pauseaiLetters = [],
  oneOffs = [],
  messages = NO_MESSAGES,
  history,
  setMark,
  editDetails,
  notes,
  onlyReplies = false,
  aliases,
  aliasesOpen = false,
  aliasActions,
}: {
  politician: Politician;
  /** Every ask, by the asks table's order. */
  asks: Ask[];
  /** Sets their answer to an ask staff record: politicianId, ask, status (blank to clear), note. */
  setStatus: (form: FormData) => void | Promise<void>;
  block?: EmailBlock;
  unblock: (form: FormData) => void | Promise<void>;
  /** Their letters, with who sent each only for staff with `supporters`. */
  letters: PoliticianLetters;
  /** PauseAI's letters to them. */
  pauseaiLetters?: PauseaiLetter[];
  /** Their one-off emails. */
  oneOffs?: OneOffThreadRow[];
  /** What's known of each letter's and thread's messages. */
  messages?: ThreadMessages;
  history: PoliticianChange[];
  /** Turns one of the marks on or off: politicianId, mark, on. */
  setMark?: (form: FormData) => void | Promise<void>;
  /** Saves what staff edit of their details (PoliticianWriting), saying whether it did, or why not. */
  editDetails?: (form: FormData) => Promise<EditResult | undefined>;
  /** Staff's notes on them, and what adding and changing them needs. */
  notes?: NotesProps;
  /** Correspondence shows only the threads they've really replied on, as Emails from them leads to. */
  onlyReplies?: boolean;
  /** Their aliases, at the foot of the page, with what changes them. */
  aliases?: PoliticianAliases;
  /** Whether the aliases are open, as when their email's link led here. */
  aliasesOpen?: boolean;
  aliasActions?: AliasActions;
}) {
  const entries: Entry[] = [
    ...letterEntries(letters),
    ...pauseaiEntries(pauseaiLetters),
    ...oneOffs.map((thread) => {
      const from = thread.someoneElse && messages.oneOffs[thread.id]?.find((step) => step.who === "other")?.name;
      return {
        key: `one-off-${thread.id}`,
        at: thread.latestAt,
        what: (
          <>
            {from ? copy.emailFrom(from) : staffCopy.oneOff.title}:{" "}
            {thread.subject === null ? (
              <Withheld>{staffCopy.oneOff.hidden}</Withheld>
            ) : (
              <>
                {thread.subject || staffCopy.oneOff.noSubject}
                <Muted>
                  {" · "}
                  <StaffLink href={`/staff/one-off/${thread.id}`}>{staffCopy.allLetters.theThread}</StaffLink>
                </Muted>
              </>
            )}
          </>
        ),
      };
    }),
    ...(notes?.notes ?? []).map((note) => ({
      key: `note-${note.id}`,
      at: note.createdAt,
      what: (
        <>
          {note.body}{" "}
          <Muted>
            · {copy.history.note} · {note.writtenBy}
          </Muted>
        </>
      ),
    })),
    ...history
      .filter((change) => change.action === "set status")
      .map((change) => ({
        key: `change-${change.id}`,
        ...whenOf(change),
        what: (
          <>
            <Detail change={change} asks={asks} /> <Muted>· {change.actor}</Muted>
          </>
        ),
      })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const changes = history
    .filter((change) => change.action !== "set status")
    .map((change) => ({
      ...change,
      what: (
        <>
          {copy.history[change.action] ?? change.action} <Detail change={change} asks={asks} />
        </>
      ),
    }));
  const threads = correspondenceThreads({ letters, pauseaiLetters, oneOffs, messages });
  const emailCounts: Count[] = [
    {
      key: "to-them",
      n: politician.emailsToThem,
      label: copy.band.emailsToThem,
      href: `/staff/politicians/${politician.id}#correspondence-title`,
    },
    {
      key: "from-them",
      n: politician.emailsFromThem,
      label: copy.band.emailsFromThem,
      href: `/staff/politicians/${politician.id}${onlyReplies ? "" : "?correspondence=replies"}`,
      current: onlyReplies,
    },
  ].filter((count) => count.n > 0);
  return (
    <>
      <PoliticianBand
        politician={politician}
        emailCounts={emailCounts}
        email={
          aliases && aliasActions ? (
            <AddressesBubble
              politician={politician}
              aliases={aliases}
              actions={aliasActions}
              setEmail={editDetails && !politician.isTest && ownEmail(politician) ? editDetails : undefined}
              open={aliasesOpen}
            />
          ) : politician.email ? (
            <a href={`mailto:${politician.email}`}>{politician.email}</a>
          ) : (
            politiciansCopy.politicians.noEmail
          )
        }
        salutation={<SalutationBubble politician={politician} action={politician.isTest ? undefined : editDetails} />}
      />
      {block && (
        <section className={styles.blocked} aria-labelledby="blocked-title">
          <Strip tone="red">
            <h2 id="blocked-title">{copy.blocked.title}</h2>
            <p>
              {copy.blocked.why.before}
              <strong>{block.address}</strong>
              {copy.blocked.why.after(block.reason, staffTime(block.since))}
            </p>
            <div className={styles.fixes}>
              {block.canReset && editDetails && ownEmail(politician) && (
                <div>
                  <h3>{copy.blocked.wrong.title}</h3>
                  <p>
                    {copy.blocked.wrong.before}
                    <StaffLink href={`/staff/politicians/${politician.id}?aliases=open`}>
                      {copy.blocked.wrong.link}
                    </StaffLink>
                    {copy.blocked.wrong.after}
                  </p>
                </div>
              )}
              <div>
                <h3>{copy.blocked.right.title}</h3>
                {block.canReset && <p>{copy.blocked.right.text}</p>}
                <UnblockForm block={block} action={unblock} />
              </div>
            </div>
          </Strip>
        </section>
      )}

      <div className={styles.scrollRoom}>
        <Grid>
          <Card
            span={4}
            title={copy.correspondence.title}
            id="correspondence-title"
            action={
              (onlyReplies || threads.some(hasReply)) && (
                <Tabs
                  label={copy.correspondence.title}
                  current={onlyReplies ? "replies" : "all"}
                  tabs={[
                    {
                      key: "all",
                      label: copy.correspondence.allEmails,
                      href: `/staff/politicians/${politician.id}#correspondence-title`,
                    },
                    {
                      key: "replies",
                      label: copy.correspondence.repliesOnly,
                      href: `/staff/politicians/${politician.id}?correspondence=replies#correspondence-title`,
                    },
                  ]}
                />
              )
            }
          >
            <PoliticianCorrespondence threads={onlyReplies ? threads.filter(hasReply) : threads} />
          </Card>
          <Column span={2}>
            <Card look="aside" title={copy.statusesTitle} id="asks-title">
              <PoliticianAsks politician={politician} asks={asks} setStatus={setStatus} />
            </Card>
            <NotesCard
              target={{ name: "politicianId", value: politician.id }}
              writer={notes?.reader.email ?? ""}
              add={notes?.add}
            >
              {(notes?.notes ?? []).map((note) => (
                <li key={note.id}>
                  <NoteEntry note={note} {...notes!} />
                </li>
              ))}
            </NotesCard>
            <Card look="aside" title={copy.marks} id="marks-title">
              <PoliticianMarks politician={politician} setMark={setMark} />
            </Card>
          </Column>
        </Grid>
        <div className={styles.foot}>
          <details className={styles.footRow}>
            <summary>
              <h2 id="history-title">{copy.historyTitle}</h2> <span className={styles.count}>{entries.length}</span>
            </summary>
            {entries.length === 0 ? (
              <Empty>{copy.noHistory}</Empty>
            ) : (
              <ol className={styles.history} aria-labelledby="history-title">
                {entries.map((entry) => (
                  <li key={entry.key}>
                    <span className={styles.when}>{entry.day ? staffDate(entry.at) : staffTime(entry.at)}</span>
                    <div>{entry.what}</div>
                  </li>
                ))}
              </ol>
            )}
          </details>
          {changes.length > 0 && (
            <details className={styles.footRow}>
              <summary>
                <h2 id="record-changes">{copy.recordTitle}</h2> <span className={styles.count}>{changes.length}</span>
              </summary>
              <ol
                className={politician.status === "in_office" ? styles.timeline : `${styles.timeline} ${styles.ended}`}
              >
                {changes.map((change) => (
                  <li key={change.id}>
                    <span>{change.what}</span>
                    <span className={styles.timelineWhen}>
                      {staffTime(change.at)} · {change.actor}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
