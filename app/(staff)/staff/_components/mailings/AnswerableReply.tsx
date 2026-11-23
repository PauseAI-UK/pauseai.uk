"use client";

import { useId, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/Text";
import { answerSubject } from "@/lib/email-parsing/subjects";
import { hasWords } from "@/lib/letters/format";
import { EMPTY_MAILING_DOC } from "@/lib/mailings/doc";
import type { AnswerResult } from "@/lib/mailings/answers";
import { uuid } from "@/lib/uuid";
import MailingEditor from "./MailingEditor";
import ThreadEmail from "../letters/ThreadEmail";
import styles from "./AnswerableReply.module.css";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.answers;

/** Sends an answer to reply `replyId`, once for each `draftId`. */
export type AnswerAction = (replyId: number, draftId: string, body: JSONContent) => Promise<AnswerResult>;

/** What an answer starts as, and where the cursor goes in it; none for the end. */
export type AnswerStart = { doc: JSONContent; cursor?: number };

/** A draft not yet written: its own ID, which sends it once however often Send is pressed, and `doc`. */
const newDraft = (doc: JSONContent) => ({ id: uuid(), doc });

/** Whether Cmd+Enter, or Ctrl+Enter off a Mac, was pressed, as Gmail sends with. */
const isSendKey = (event: KeyboardEvent) => event.key === "Enter" && (event.metaKey || event.ctrlKey);

/**
 * Reply, in orange: opens the answer to a reply at the foot of the thread
 * (AnswerableReply). Follow up, under our answer to it (`followUp`).
 */
export function ReplyButton({ write, followUp = false }: { write: () => void; followUp?: boolean }) {
  return (
    <Button variant="primary" size="small" fit type="button" onClick={write}>
      {followUp ? copy.followUp : copy.reply}
    </Button>
  );
}

/**
 * A reply in a thread, a broadcast's or a mailing's letter's (`children`,
 * given what opens the answer, `write`, while it isn't open, for its Reply
 * button, ReplyButton), and after it the answer, once Reply is pressed.
 * Opened, it's as it will be once sent: by default an email from the
 * address ours went from (`from`), to the reply's sender (`to`), its
 * subject "Re:" the reply's; or in `shell`, such as a text's bubble. Its
 * words are in the mailings' editor without merge fields, starting as
 * `start`, or empty. Pressing Reply puts the cursor in the editor. Send
 * reply, or Cmd+Enter (Ctrl+Enter off a Mac), sends it (`answer`); sent, it
 * closes, and the page shows it in the thread. One that didn't go stays
 * open, saying why. Discard closes it, its words gone. `warning` goes over
 * the editor. Send waits for words of the staff member's own, beyond
 * `start`. `opened` shows it being written to begin with, as the gallery
 * does, leaving the cursor where it is.
 */
export default function AnswerableReply({
  replyId,
  from,
  to,
  subject,
  answer,
  opened = false,
  start = { doc: EMPTY_MAILING_DOC as JSONContent },
  warning,
  shell,
  children,
}: {
  replyId: number;
  from: string;
  to: string;
  subject: string;
  answer: AnswerAction;
  opened?: boolean;
  start?: AnswerStart;
  warning?: ReactNode;
  shell?: (draft: ReactNode) => ReactNode;
  children: (write: (() => void) | undefined) => ReactNode;
}) {
  const [first] = useState(start);
  const [open, setOpen] = useState(opened);
  // Opened by pressing it, rather than shown open, so the cursor goes to it.
  const [pressed, setPressed] = useState(false);
  const [draft, setDraft] = useState(() => newDraft(first.doc));
  const [failed, setFailed] = useState<Exclude<AnswerResult, { sent: true }>["reason"]>();
  const [sending, startSending] = useTransition();
  const label = useId();
  // Nothing written: no words, or only what it started with.
  const blank = !hasWords(draft.doc) || draft.doc === first.doc;

  function fold() {
    setOpen(false);
    setDraft(newDraft(first.doc));
    setFailed(undefined);
  }

  function sendIt() {
    if (blank || sending) return;
    startSending(async () => {
      const result = await answer(replyId, draft.id, draft.doc);
      if (result.sent) fold();
      else setFailed(result.reason);
    });
  }

  const write = () => {
    setOpen(true);
    setPressed(true);
  };

  const editor = (
    <div
      onKeyDownCapture={(event) => {
        if (!isSendKey(event)) return;
        event.preventDefault();
        sendIt();
      }}
    >
      {warning}
      <span id={label} className={styles.hidden}>
        {copy.answerLabel}
      </span>
      <MailingEditor
        key={draft.id}
        initial={first.doc}
        onChange={(doc) => setDraft((was) => ({ ...was, doc }))}
        fields={[]}
        conditions={[]}
        labelledBy={label}
        plain
        autoFocus={pressed && (first.cursor ?? true)}
      />
      <div className={`${styles.buttons} ${styles.draftButtons}`}>
        <Button variant="primary" size="small" fit type="button" disabled={blank || sending} onClick={sendIt}>
          {sending ? copy.sending : copy.send}
        </Button>
        <Button variant="ghost" size="small" fit type="button" disabled={sending} onClick={fold}>
          {copy.discard}
        </Button>
      </div>
      {failed && (
        <p className={styles.problem} role="alert">
          <ErrorText>{copy.notSent[failed]}</ErrorText>
        </p>
      )}
    </div>
  );

  return (
    <>
      {children(open ? undefined : write)}
      {open &&
        (shell ? (
          shell(editor)
        ) : (
          <ThreadEmail from={from} to={to} at={null} subject={answerSubject(subject)}>
            {editor}
          </ThreadEmail>
        ))}
    </>
  );
}
