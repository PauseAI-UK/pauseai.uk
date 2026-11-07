import type { LetterSummary, PauseaiLetter, PoliticianLetters, UnsignedLetter } from "@/lib/server/letters";
import type { OneOffThreadRow } from "@/lib/server/one-off-emails";

// A politician's threads as their page lists them: a line of who wrote and
// when, from what the database knows of each message, never its text.

/** One message of a thread: who sent it, when, and whether a machine did. */
export type ThreadStep = {
  at: string;
  /** PauseAI; them or their office; the supporter who wrote the letter; or anyone else on a one-off thread. */
  who: "us" | "them" | "supporter" | "other";
  /** Their name, when the message gave one that this reader may see. */
  name: string | null;
  auto: boolean;
};

/** Each letter's and one-off thread's messages, oldest first, by ID, and roughly how many emails went each way. */
export type ThreadMessages = {
  letters: Record<number, ThreadStep[]>;
  oneOffs: Record<number, ThreadStep[]>;
  emailsToThem: number;
  emailsFromThem: number;
};

/** A letter or a one-off thread: a null `title` is a thread this reader can't see, and a null `href` one they can't open. */
export type CorrespondenceThread = {
  key: string;
  title: string | null;
  href: string | null;
  /** When anything last happened on it. */
  at: string;
  /** Who wrote a supporter's letter, when this reader may see. */
  sender: string | null;
  /** How a letter without its sender stands, as that's all this reader has of it. */
  status: string | null;
  ownWords: number | null;
  someoneElse: boolean;
  steps: ThreadStep[];
  /** It went to them and nothing's come back from them but automatic replies. */
  noReply: boolean;
};

/** Letters that never went, which there's no correspondence about. */
const NEVER_WENT = ["not_sent", "scheduled", "cancelled", "skipped", "queued"];

const iso = (at: string) => new Date(at).toISOString();

const replied = (step: ThreadStep) => step.who === "them" && !step.auto;

/** A run of automatic replies, as one. */
const oneAutoReply = (step: ThreadStep, i: number, steps: ThreadStep[]) => !(step.auto && steps[i - 1]?.auto);

/** A thread from its steps: when it last moved, and whether it's waiting on them. */
function thread(
  fields: Omit<CorrespondenceThread, "at" | "steps" | "noReply" | "someoneElse"> & { someoneElse?: boolean },
  sent: string,
  steps: ThreadStep[],
): CorrespondenceThread {
  const kept = steps.filter(oneAutoReply);
  const times = [sent, ...kept.map((step) => step.at)].map(iso).sort();
  const someoneElse = fields.someoneElse ?? false;
  return {
    ...fields,
    someoneElse,
    at: times[times.length - 1],
    steps: kept,
    noReply: !someoneElse && !kept.some(replied),
  };
}

/** A letter's steps: its own first, if no kept message is it, and a reply the letter knows of when nothing from them was kept. */
function letterSteps(
  own: ThreadStep["who"],
  written: string,
  repliedAt: string | null,
  messages: ThreadStep[],
): ThreadStep[] {
  const steps =
    messages[0]?.who === own ? messages : [{ at: iso(written), who: own, name: null, auto: false }, ...messages];
  return repliedAt && !steps.some((step) => step.who === "them")
    ? [...steps, { at: iso(repliedAt), who: "them", name: null, auto: false }]
    : steps;
}

function supporterThread(letter: LetterSummary | UnsignedLetter, senders: boolean, messages: ThreadStep[]) {
  const signed = senders ? (letter as LetterSummary) : null;
  return thread(
    {
      key: `letter-${letter.id}`,
      title: letter.campaignTitle,
      href: signed && `/staff/letters/${letter.id}`,
      sender: signed && signed.senderName,
      status: signed ? null : letter.status,
      ownWords: signed && signed.ownWords,
    },
    letter.createdAt,
    letterSteps("supporter", letter.createdAt, letter.repliedAt, messages),
  );
}

function pauseaiThread(letter: PauseaiLetter, messages: ThreadStep[]) {
  return thread(
    {
      key: `letter-${letter.id}`,
      title: letter.mailing,
      href: `/staff/mailings/${letter.mailingId}/letters/${letter.id}`,
      sender: null,
      status: null,
      ownWords: null,
    },
    letter.at,
    letterSteps("us", letter.at, null, messages),
  );
}

function oneOffThread(row: OneOffThreadRow, messages: ThreadStep[]) {
  return thread(
    {
      key: `one-off-${row.id}`,
      title: row.subject,
      href: row.subject === null ? null : `/staff/one-off/${row.id}`,
      sender: null,
      status: null,
      ownWords: null,
      someoneElse: row.someoneElse,
    },
    row.latestAt,
    messages,
  );
}

/** Every letter that went to them and every one-off thread of theirs, newest activity first. */
export function correspondenceThreads({
  letters,
  pauseaiLetters,
  oneOffs,
  messages,
}: {
  letters: PoliticianLetters;
  pauseaiLetters: PauseaiLetter[];
  oneOffs: OneOffThreadRow[];
  messages: ThreadMessages;
}): CorrespondenceThread[] {
  const went = <T extends { status: string }>(list: readonly T[]) => list.filter((l) => !NEVER_WENT.includes(l.status));
  return [
    ...went<LetterSummary | UnsignedLetter>(letters.letters).map((letter) =>
      supporterThread(letter, letters.senders, messages.letters[letter.id] ?? []),
    ),
    ...went(pauseaiLetters).map((letter) => pauseaiThread(letter, messages.letters[letter.id] ?? [])),
    ...oneOffs.map((row) => oneOffThread(row, messages.oneOffs[row.id] ?? [])),
  ].sort((a, b) => b.at.localeCompare(a.at));
}
