"use client";

import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import { UnsubscribeForm } from "./OptOutForm";
import styles from "./ReplyActions.module.css";

const copy = staffCopy.broadcastPages;
/** Each topic's name, as the consents and lists say it. */
const topicNames = staffCopy.supporters.detail.permissions.topics;

/** Reply, in orange: opens the answer to a reply at the foot of the thread (AnswerableReply). */
export function ReplyButton({ write }: { write: () => void }) {
  return (
    <Button variant="primary" size="small" fit type="button" onClick={write}>
      {copy.replies.reply}
    </Button>
  );
}

/**
 * Under a reply waiting for staff: Reply, while its answer isn't open
 * (`write`); Unsubscribe them, the form a supporter's
 * page has, for what the email went under (`topics`) or every bulk email,
 * at the address that replied, with no need to say how they told us, as
 * it's the reply; and beside it
 * Nothing to do, which one `answered` already has no need of. Each sends
 * the reply's ID and its decision. The answer is written at the foot of
 * the thread (AnswerableReply).
 */
export default function ReplyActions({
  replyId,
  topics,
  deal,
  answered = false,
  write,
}: {
  replyId: number;
  topics: Topic[];
  answered?: boolean;
  write?: () => void;
  deal: (form: FormData) => void | Promise<void>;
}) {
  return (
    <div className={styles.actions}>
      <UnsubscribeForm
        id={`opt-out-${replyId}`}
        hidden={{ replyId: String(replyId) }}
        field="decision"
        options={[
          { value: "topics", label: copy.replies.topics(topics.map((t) => topicNames[t]).join(", ")) },
          { value: "bulk", label: copy.replies.bulk },
        ]}
        howKnown
        record={deal}
        spaced={false}
        before={write && <ReplyButton write={write} />}
        beside={
          !answered && (
            <form action={deal}>
              <input type="hidden" name="replyId" value={replyId} />
              <SubmitButton variant="ghost" size="small" fit name="decision" value="nothing">
                {copy.replies.nothing}
              </SubmitButton>
            </form>
          )
        }
      />
    </div>
  );
}
