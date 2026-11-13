"use client";

import { useId, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { answerSubject } from "@/lib/email-parsing/subjects";
import { hasWords } from "@/lib/letter-format";
import { EMPTY_MAILING_DOC } from "@/lib/mailing-doc";
import type { AnswerResult } from "@/lib/server/broadcast-answers";
import Alert from "./Alert";
import MailingEditor from "./MailingEditor";
import { ChatBubble, ChatWall } from "./TextBubble";
import ThreadEmail from "./ThreadEmail";
import styles from "./ReplyActions.module.css";

const copy = staffCopy.broadcastPages.replies;

/** Sends an answer to reply `replyId`, once for each `draftId`. */
export type AnswerAction = (replyId: number, draftId: string, body: JSONContent) => Promise<AnswerResult>;

/** A draft not yet written: its own ID, which sends it once however often Send is pressed, and no words. */
const newDraft = () => ({ id: crypto.randomUUID(), doc: EMPTY_MAILING_DOC as JSONContent });

/** Whether Cmd+Enter, or Ctrl+Enter off a Mac, was pressed, as Gmail sends with. */
const isSendKey = (event: KeyboardEvent) => event.key === "Enter" && (event.metaKey || event.ctrlKey);

/**
 * A reply in a broadcast's thread (`children`, given what opens the answer,
 * `write`, while it isn't open, for its Reply button, ReplyButton), and
 * after it the answer, once Reply is pressed. Opened, it's as it will be
 * once sent: from the address our email went from (`from`), to the reply's
 * sender (`to`), its subject "Re:" the reply's, its words in the
 * broadcasts' editor without merge fields. Pressing Reply puts the cursor
 * in the editor. Send reply, or Cmd+Enter (Ctrl+Enter off a Mac), sends it
 * (`answer`); sent, it closes, and the page shows it in the thread. One
 * that didn't go stays open, saying why. Discard closes it, its words gone.
 * To someone with "Do not email" (`doNotEmail`), it warns that it goes all
 * the same. To a text's reply (`text`), it's a bubble of ours, with no
 * subject, and goes by WhatsApp.
 * `opened` shows it being written to begin with, as the gallery does,
 * leaving the cursor where it is.
 */
export default function AnswerableReply({
  replyId,
  from,
  to,
  subject,
  answer,
  doNotEmail = false,
  opened = false,
  text = false,
  children,
}: {
  replyId: number;
  from: string;
  to: string;
  subject: string;
  answer: AnswerAction;
  doNotEmail?: boolean;
  opened?: boolean;
  text?: boolean;
  children: (write: (() => void) | undefined) => ReactNode;
}) {
  const [open, setOpen] = useState(opened);
  // Opened by pressing it, rather than shown open, so the cursor goes to it.
  const [pressed, setPressed] = useState(false);
  const [draft, setDraft] = useState(newDraft);
  const [failed, setFailed] = useState<Exclude<AnswerResult, { sent: true }>["reason"]>();
  const [sending, startSending] = useTransition();
  const label = useId();
  const blank = !hasWords(draft.doc);

  function fold() {
    setOpen(false);
    setDraft(newDraft());
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

  return (
    <>
      {children(open ? undefined : write)}
      {open && (
        <AnswerShell text={text} from={from} to={to} subject={subject}>
          <div
            onKeyDownCapture={(event) => {
              if (!isSendKey(event)) return;
              event.preventDefault();
              sendIt();
            }}
          >
            {doNotEmail && <Alert tone="amber">{copy.doNotEmail}</Alert>}
            <span id={label} className={styles.hidden}>
              {copy.answerLabel}
            </span>
            <MailingEditor
              key={draft.id}
              initial={EMPTY_MAILING_DOC}
              onChange={(doc) => setDraft((was) => ({ ...was, doc }))}
              fields={[]}
              conditions={[]}
              labelledBy={label}
              plain
              autoFocus={pressed}
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
        </AnswerShell>
      )}
    </>
  );
}

/** What an answer being written sits in: an email of ours to them, "Re:" their reply; or a bubble of ours, for a text. */
function AnswerShell({
  text,
  from,
  to,
  subject,
  children,
}: {
  text: boolean;
  from: string;
  to: string;
  subject: string;
  children: ReactNode;
}) {
  if (text) {
    return (
      <ChatWall>
        <ChatBubble who={from} when="" ours>
          {children}
        </ChatBubble>
      </ChatWall>
    );
  }
  return (
    <ThreadEmail from={from} to={to} at={null} subject={answerSubject(subject)}>
      {children}
    </ThreadEmail>
  );
}
