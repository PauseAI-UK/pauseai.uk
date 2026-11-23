"use client";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { listFor, unsubscribeTopics, type Topic } from "@/lib/supporters/contact-permissions";
import { UnsubscribeForm } from "../supporters/OptOutForm";
import { ReplyButton } from "../mailings/AnswerableReply";
import answerStyles from "../mailings/AnswerableReply.module.css";
import { supportersCopy } from "../supporters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;
/** Each list's name, as the Consent filter says it. */
const listNames = supportersCopy.supporters.filters.lists;

/**
 * Under a reply waiting for staff: Reply, while its answer isn't open
 * (`write`), Follow up under our answer (`followUp`); Unsubscribe them, the form a supporter's
 * page has, for the list the email's unsubscribe link stops, from what it
 * went under (`topics`, unsubscribeTopics), or every bulk email,
 * or for a reply to a text (`text`), that list or every text,
 * at the address or number that replied, with no need to say how they told us, as
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
  text = false,
  write,
  followUp = false,
}: {
  replyId: number;
  topics: Topic[];
  answered?: boolean;
  text?: boolean;
  write?: () => void;
  followUp?: boolean;
  deal: (form: FormData) => void | Promise<void>;
}) {
  return (
    <div className={answerStyles.actions}>
      <UnsubscribeForm
        id={`opt-out-${replyId}`}
        hidden={{ replyId: String(replyId) }}
        field="decision"
        options={[
          {
            value: "topics",
            label: (text ? copy.replies.topicsText : copy.replies.topics)(
              listNames[listFor(unsubscribeTopics(topics))],
            ),
          },
          { value: "bulk", label: text ? copy.replies.allTexts : copy.replies.bulk },
        ]}
        howKnown
        record={deal}
        spaced={false}
        end={text}
        before={write && <ReplyButton write={write} followUp={followUp} />}
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
