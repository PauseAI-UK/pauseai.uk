import StaffLink from "./ui/StaffLink";
import type { ReactNode } from "react";
import { staffCopy } from "@/lib/content/staff-interface";
import { asksAgreed } from "@/lib/asks";
import type { Ask } from "@/lib/server/asks";
import { AskTitle } from "./AskLine";
import { PoliticianAsks } from "./AskRow";
import CampaignName from "./CampaignName";
import { FieldChanges } from "./AuditDetail";
import type { FieldChange } from "@/lib/field-changes";
import { importPath } from "@/lib/import-runs";
import type { EmailBlock } from "@/lib/server/email";
import type { OneOffThreadRow } from "@/lib/server/one-off-emails";
import type { LetterSummary, PauseaiLetter, PoliticianLetters, UnsignedLetter } from "@/lib/server/letters";
import type { Politician, PoliticianChange } from "@/lib/server/politicians";
import { correspondenceThreads, hasReply, type ThreadMessages } from "@/lib/politician-correspondence";
import { staffDate, staffTime } from "@/lib/staff-time";
import styles from "./Details.module.css";
import Band, { BandFact } from "./ui/Band";
import Counts, { type Count } from "./ui/Counts";
import Empty from "./ui/Empty";
import Grid, { Card, Column } from "./ui/Grid";
import { ListTable, type ListColumn } from "./ui/ListFrame";
import Strip from "./ui/Strip";
import Tabs from "./ui/Tabs";
import Withheld from "./ui/Withheld";
import { NationShape, Rosette, StatusDot } from "./PoliticianIcons";
import UnblockForm from "./UnblockForm";
import NotesCard from "./NotesCard";
import { NoteEntry, NoteFrom, type NotesProps } from "./Notes";
import PoliticianCorrespondence from "./PoliticianCorrespondence";
import { statusOf } from "./LetterStatus";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import TestTag from "./TestTag";
import ExternalLink from "./ui/ExternalLink";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AddResult, PoliticianAliases } from "@/lib/server/politician-aliases";
import AddAliasForm from "./AddAliasForm";

const copy = staffCopy.politician;

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
      const label = staffCopy.statuses[text("status")] ?? text("status");
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
 * The band at the top of their page: their name and tags, with whether
 * their record has gone from Airtable, and under it what they are; at its
 * top right, quietly, where their record came from, an Airtable MP's linked
 * to it there; then their party, whether they're in office, their nation
 * and how to write to them; and roughly how many emails went each way, when
 * any did, each leading to Correspondence, and how many asks they agreed to
 * (asksAgreed).
 */
function PoliticianBand({
  politician,
  emailCounts,
  airtableTable,
  aliases,
}: {
  politician: Politician;
  emailCounts: Count[];
  airtableTable: string;
  /** Whether the page has their aliases, which their email then leads to. */
  aliases: boolean;
}) {
  const inOffice = politician.status === "in_office";
  const source = politician.isTest
    ? copy.sources.test
    : politician.airtableId
      ? copy.sources.airtable
      : copy.sources.staff;
  return (
    <Band
      className={styles.band}
      title={politician.name}
      subtitle={copy.role(copy.roles[politician.house], politician.constituency, inOffice)}
      tag={
        <>
          <TestTag isTest={politician.isTest} />
          {politician.importantTarget && <Tag tone="amber">{copy.importantTarget}</Tag>}
          {politician.personalConnection && <Tag>{copy.personalConnection}</Tag>}
          {politician.airtableRemovedAt && (
            <Tag tone="amber">{copy.airtableRemoved(staffDate(politician.airtableRemovedAt))}</Tag>
          )}
        </>
      }
      corner={
        <>
          {copy.source}{" "}
          {politician.airtableId ? (
            <>
              <ExternalLink href={`${airtableTable}/${politician.airtableId}`}>{source}</ExternalLink>
              {copy.editInAirtable}
            </>
          ) : (
            source
          )}
        </>
      }
      aside={
        <Counts
          counts={[
            ...emailCounts,
            {
              key: "asks",
              n: asksAgreed(politician.statuses),
              label: copy.band.asksAgreed(asksAgreed(politician.statuses)),
              href: `/staff/politicians/${politician.id}#asks-title`,
            },
          ]}
        />
      }
    >
      <BandFact label={staffCopy.fields.party}>
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
          {staffCopy.personStatuses[politician.status]}
        </span>
      </BandFact>
      <BandFact label={copy.country}>
        {politician.country && (
          <span className={styles.withIcon}>
            <NationShape country={politician.country} />
            {staffCopy.countries[politician.country]}
          </span>
        )}
      </BandFact>
      <BandFact
        label={staffCopy.fields.email}
        link={
          aliases && (
            <StaffLink href={`/staff/politicians/${politician.id}?aliases=open#aliases`}>{copy.aliases.see}</StaffLink>
          )
        }
        detail={politician.salutation}
      >
        {politician.email ? (
          <a href={`mailto:${politician.email}`}>{politician.email}</a>
        ) : (
          staffCopy.politicians.noEmail
        )}
      </BandFact>
    </Band>
  );
}

const NO_MESSAGES: ThreadMessages = { subjects: {}, letters: {}, oneOffs: {} };

/** A line of a politician's aliases: an address or domain, and where it came from. */
type AliasRow = { key: string; address: string; from: ReactNode };

/** The changes a politician's aliases can take: adding an address, removing one staff added. */
export type AliasActions = {
  add: (form: FormData) => Promise<AddResult | undefined> | AddResult | undefined | void;
  remove: (form: FormData) => void | Promise<void>;
};

/**
 * A politician's aliases, folded at the foot of their page, open when their
 * email's link led here: every address and domain that says an email is
 * theirs, with where each came from, those staff added with who added them;
 * a button by each staff added or guessed was their office's, to remove it;
 * then the form to add one.
 */
function Aliases({
  politicianId,
  aliases,
  open,
  actions,
}: {
  politicianId: number;
  aliases: PoliticianAliases;
  open: boolean;
  actions: AliasActions;
}) {
  const words = copy.aliases;
  const of = (key: string, addresses: string[], from: ReactNode): AliasRow[] =>
    addresses.map((address) => ({ key: `${key} ${address}`, address, from }));
  /** A line staff can remove: where it came from, and its Remove button beside. */
  const removable = (key: string, address: string, from: ReactNode): AliasRow => ({
    key: `${key} ${address}`,
    address,
    from: (
      <span className={styles.aliasAdded}>
        {from}
        <FilterForm action={actions.remove} aria-label={`${words.remove}: ${address}`}>
          <input type="hidden" name="politicianId" value={politicianId} />
          <input type="hidden" name="address" value={address} />
          <SubmitButton variant="ghost" size="small" fit>
            {words.remove}
          </SubmitButton>
        </FilterForm>
      </span>
    ),
  });
  const rows: AliasRow[] = [
    ...of("email", aliases.email ? [aliases.email] : [], words.sources.email),
    ...of("past", aliases.past, words.sources.past),
    ...of("parliament", aliases.parliament, words.sources.parliament),
    ...aliases.office.map((address) => removable("office", address, words.sources.office)),
    ...aliases.added.map(({ address, addedBy, at }) =>
      removable("added", address, words.addedBy(addedBy, staffDate(at))),
    ),
    ...of(
      "domain",
      aliases.domains.map((domain) => `@${domain}`),
      words.sources.domain,
    ),
    ...of("form", aliases.forms, words.sources.form),
  ];
  return (
    <details className={styles.footRow} id="aliases" open={open}>
      <summary>
        <h2 id="aliases-title">{words.title}</h2> <span className={styles.count}>{rows.length}</span>
      </summary>
      <p className={styles.aliasIntro}>{words.intro}</p>
      <ListTable columns={aliasColumns} rows={rows} rowKey={(row) => row.key} />
      <AddAliasForm politicianId={politicianId} action={actions.add} />
    </details>
  );
}

const aliasColumns: ListColumn<AliasRow>[] = [
  { key: "address", label: copy.aliases.columns.address, cell: (row) => row.address },
  { key: "from", label: copy.aliases.columns.from, cell: (row) => row.from },
];

const changeColumns: ListColumn<PoliticianChange & { what: ReactNode }>[] = [
  { key: "at", label: staffCopy.supporters.detail.held.columns.when, short: true, cell: (c) => staffTime(c.at) },
  { key: "what", label: staffCopy.supporters.detail.held.columns.what, cell: (c) => c.what },
  { key: "who", label: copy.recordWho, cell: (c) => c.actor },
];

/**
 * A politician's page, laid out like a supporter's: the band of who they
 * are (PoliticianBand); if their address is blocked, why, and a way to
 * unblock it; then their correspondence (PoliticianCorrespondence); and
 * beside it the card of their answer to each ask, with the button to change
 * one staff record, and the card of staff's notes (NotesCard), with Airtable's
 * notes on them, which are changed there, as the last. Under those, folded as a
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
  airtableTable,
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
  /** Airtable's table of MPs, which the server knows; an MP's record there is under it. */
  airtableTable: string;
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
        airtableTable={airtableTable}
        aliases={!!(aliases && aliasActions)}
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
              {block.canReset && (
                <div>
                  <h3>{copy.blocked.wrong.title}</h3>
                  <p>
                    {copy.blocked.wrong.before}
                    <ExternalLink
                      href={politician.airtableId ? `${airtableTable}/${politician.airtableId}` : airtableTable}
                    >
                      {copy.blocked.wrong.airtable}
                    </ExternalLink>
                    {copy.blocked.wrong.middle}
                    <StaffLink href={importPath("sync-politicians")}>{copy.blocked.wrong.link}</StaffLink>
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
              {[
                ...(notes?.notes ?? []).map((note) => (
                  <li key={note.id}>
                    <NoteEntry note={note} {...notes!} />
                  </li>
                )),
                ...(politician.notes
                  ? [
                      <li key="airtable">
                        <NoteFrom body={politician.notes} source={copy.notes} />
                      </li>,
                    ]
                  : []),
              ]}
            </NotesCard>
          </Column>
        </Grid>
        <div className={styles.foot}>
          {entries.length === 0 ? (
            <section aria-labelledby="history-title" className={styles.footRow}>
              <h2 id="history-title">{copy.historyTitle}</h2> <Empty inline>{copy.noHistory}</Empty>
            </section>
          ) : (
            <details className={styles.footRow}>
              <summary>
                <h2 id="history-title">{copy.historyTitle}</h2> <span className={styles.count}>{entries.length}</span>
              </summary>
              <ol className={styles.history} aria-labelledby="history-title">
                {entries.map((entry) => (
                  <li key={entry.key}>
                    <span className={styles.when}>{entry.day ? staffDate(entry.at) : staffTime(entry.at)}</span>
                    <div>{entry.what}</div>
                  </li>
                ))}
              </ol>
            </details>
          )}
          {changes.length > 0 && (
            <details className={styles.footRow}>
              <summary>
                <h2 id="record-changes">{copy.recordTitle}</h2> <span className={styles.count}>{changes.length}</span>
              </summary>
              <ListTable columns={changeColumns} rows={changes} rowKey={(change) => String(change.id)} />
            </details>
          )}
          {aliases && aliasActions && (
            <Aliases politicianId={politician.id} aliases={aliases} open={aliasesOpen} actions={aliasActions} />
          )}
        </div>
      </div>
    </>
  );
}
