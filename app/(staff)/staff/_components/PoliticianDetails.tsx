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
import { NoteEntry, type NotesProps } from "./Notes";
import PoliticianCorrespondence from "./PoliticianCorrespondence";
import { statusOf } from "./LetterStatus";
import { Muted } from "@/components/ui/Text";
import ExternalLink from "./ui/ExternalLink";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AddResult, PoliticianAliases } from "@/lib/server/politician-aliases";
import AddAliasForm from "./AddAliasForm";
import EditPoliticianForm from "./EditPoliticianForm";
import PoliticianMarks from "./PoliticianMarks";
import { bodyOf, officialProfile } from "@/lib/official-profiles";
import type { EditResult } from "@/lib/server/politician-edits";

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
  aliases,
}: {
  politician: Politician;
  emailCounts: Count[];
  /** Whether the page has how we write to them, where their email leads, to change it. */
  aliases: boolean;
}) {
  const edit = aliases && (
    <StaffLink href={`/staff/politicians/${politician.id}?aliases=open#aliases`}>{copy.aliases.edit}</StaffLink>
  );
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
      <BandFact label={staffCopy.fields.email} link={edit}>
        {politician.email ? (
          <a href={`mailto:${politician.email}`}>{politician.email}</a>
        ) : (
          staffCopy.politicians.noEmail
        )}
      </BandFact>
    </Band>
  );
}

/** Whether staff keep their email: a Lord's, as most Lords list none of their own. */
const ownEmail = (politician: Politician) => politician.house === "lords";

const NO_MESSAGES: ThreadMessages = { subjects: {}, letters: {}, oneOffs: {} };

/** A line of a politician's aliases: an address or domain, and where it came from. */
/** What an address is to them, for its icon: where letters go, one they had, their body's, their office's, one staff added, their domain, or a form of their name. */
type AliasKind = "email" | "past" | "parliament" | "office" | "added" | "domain" | "form";

type AliasRow = { key: string; kind: AliasKind; address: ReactNode; from: ReactNode; remove?: ReactNode };

/** Each kind of address's icon, a line drawing in the text's colour. */
const ALIAS_ICONS: Record<AliasKind, ReactNode> = {
  email: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  past: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" />,
  parliament: <path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2 10l10-6 10 6z" />,
  office: <path d="M4 21V5h10v16M14 9h6v12M7 9h3M7 13h3M7 17h3" />,
  added: <path d="M15 19c0-2.5-2.7-4-6-4s-6 1.5-6 4M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 8v6M16 11h6" />,
  domain: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />,
  form: <path d="M10 14l4-4M9 7l1-1a4 4 0 0 1 6 6l-1 1M15 17l-1 1a4 4 0 0 1-6-6l1-1" />,
};

/** The changes a politician's aliases can take: adding an address, removing one staff added. */
export type AliasActions = {
  add: (form: FormData) => Promise<AddResult | undefined> | AddResult | undefined | void;
  remove: (form: FormData) => void | Promise<void>;
};

/**
 * How we write to a politician, folded at the foot of their page, open when
 * a link to change their email or salutation led here: how a letter to them
 * starts, with its Edit; then every address and domain that says an email
 * is theirs, an icon for what each is, and under it where it came from,
 * those staff added with who added them and a button to remove those and
 * their office's; a Lord's own email with its Edit; then, once they have
 * an address letters go to, the form to add one. Beside them, what changed
 * their record, newest first.
 */
function Aliases({
  politicianId,
  aliases,
  open,
  actions,
  salutation,
  email,
  changes,
}: {
  politicianId: number;
  aliases: PoliticianAliases;
  open: boolean;
  actions: AliasActions;
  /** How a letter to them starts, with its Edit for staff who can change it. */
  salutation: ReactNode;
  /** A Lord's email, with its Edit, in place of the address letters go to. */
  email?: ReactNode;
  changes: (PoliticianChange & { what: ReactNode })[];
}) {
  const words = copy.aliases;
  const of = (kind: AliasKind, addresses: string[], from: ReactNode): AliasRow[] =>
    addresses.map((address) => ({ key: `${kind} ${address}`, kind, address, from }));
  /** A line staff can remove: where it came from, and its Remove button. */
  const removable = (kind: AliasKind, address: string, from: ReactNode): AliasRow => ({
    key: `${kind} ${address}`,
    kind,
    address,
    from,
    remove: (
      <FilterForm action={actions.remove} aria-label={`${words.remove}: ${address}`}>
        <input type="hidden" name="politicianId" value={politicianId} />
        <input type="hidden" name="address" value={address} />
        <SubmitButton variant="ghost" size="small" fit>
          {words.remove}
        </SubmitButton>
      </FilterForm>
    ),
  });
  const main: AliasRow[] =
    email === undefined
      ? of("email", aliases.email ? [aliases.email] : [], words.sources.email)
      : [{ key: "email", kind: "email", address: email, from: words.sources.email }];
  const rows: AliasRow[] = [
    ...main,
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
        <h2 id="aliases-title">{copy.writing}</h2> <span className={styles.count}>{rows.length}</span>
      </summary>
      <div className={styles.writing}>
        <div className={styles.writingMain}>
          <section className={styles.salutation} aria-labelledby="aliases-salutation">
            <h3 id="aliases-salutation" className={styles.aliasHeading}>
              {copy.editDetails.salutation}
            </h3>
            {salutation}
          </section>
          <section aria-labelledby="aliases-addresses">
            <h3 id="aliases-addresses" className={styles.aliasHeading}>
              {words.title}
            </h3>
            <p className={styles.aliasIntro}>{words.intro}</p>
            <ul className={styles.addresses}>
              {rows.map((row) => (
                <li key={row.key}>
                  <svg className={styles.addressIcon} viewBox="0 0 24 24" aria-hidden="true">
                    {ALIAS_ICONS[row.kind]}
                  </svg>
                  <span className={styles.addressText}>
                    <span className={styles.address}>{row.address}</span>
                    <span className={styles.addressFrom}>{row.from}</span>
                  </span>
                  {row.remove}
                </li>
              ))}
            </ul>
            {aliases.email && <AddAliasForm politicianId={politicianId} action={actions.add} />}
          </section>
        </div>
        {changes.length > 0 && (
          <section className={styles.timelineColumn} aria-labelledby="record-changes">
            <h3 id="record-changes" className={styles.aliasHeading}>
              {copy.recordTitle} <span className={styles.count}>{changes.length}</span>
            </h3>
            <ol className={styles.timeline}>
              {changes.map((change) => (
                <li key={change.id}>
                  <span className={styles.timelineWhat}>{change.what}</span>
                  <span className={styles.timelineWhen}>
                    {staffTime(change.at)} · {change.actor}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </details>
  );
}

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
  /** Saves what staff edit of their details (EditPoliticianForm), saying whether it did, or why not. */
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
      <PoliticianBand politician={politician} emailCounts={emailCounts} aliases={!!(aliases && aliasActions)} />
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
                    <StaffLink href={`/staff/politicians/${politician.id}?aliases=open#aliases`}>
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
          {aliases && aliasActions ? (
            <Aliases
              politicianId={politician.id}
              aliases={aliases}
              open={aliasesOpen}
              actions={aliasActions}
              salutation={
                <EditPoliticianForm
                  politician={politician}
                  field="salutation"
                  action={politician.isTest ? undefined : editDetails}
                />
              }
              email={
                editDetails && !politician.isTest && ownEmail(politician) ? (
                  <EditPoliticianForm politician={politician} field="email" action={editDetails} />
                ) : undefined
              }
              changes={changes}
            />
          ) : (
            changes.length > 0 && (
              <details className={styles.footRow}>
                <summary>
                  <h2 id="record-changes">{copy.recordTitle}</h2> <span className={styles.count}>{changes.length}</span>
                </summary>
                <ListTable columns={changeColumns} rows={changes} rowKey={(change) => String(change.id)} />
              </details>
            )
          )}
        </div>
      </div>
    </>
  );
}
