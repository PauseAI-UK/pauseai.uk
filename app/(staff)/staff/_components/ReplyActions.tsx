"use client";

import { buttonClass } from "@/components/ui/Button";
import { FormStack } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import Menu, { menuItemsClass } from "./ui/Menu";
import MenuSubmit from "./ui/MenuSubmit";
import styles from "./ReplyActions.module.css";

const copy = staffCopy.broadcastPages;
/** Each topic's name, as the consents and lists say it. */
const topicNames = staffCopy.supporters.detail.permissions.topics;

/**
 * Under a reply waiting for staff: Opt out, a menu of what it's an opt-out
 * of, what the email went under (`topics`) or every bulk email; and Nothing
 * to do, which one `answered` already has no need of. Each sends the
 * reply's ID and its decision. The answer is written at the foot of the
 * thread (AnswerableReply).
 */
export default function ReplyActions({
  replyId,
  topics,
  deal,
  answered = false,
}: {
  replyId: number;
  topics: Topic[];
  answered?: boolean;
  deal: (form: FormData) => void | Promise<void>;
}) {
  return (
    <FormStack action={deal} className={styles.actions}>
      <input type="hidden" name="replyId" value={replyId} />
      <div className={styles.buttons}>
        <Menu
          id={`opt-out-${replyId}`}
          trigger={buttonClass({ variant: "ghost", size: "small", fit: true })}
          label={`${copy.replies.optOut} ▾`}
          name={copy.replies.optOut}
        >
          <div className={menuItemsClass}>
            <MenuSubmit name="decision" value="topics">
              {copy.replies.topics(topics.map((t) => topicNames[t]).join(", "))}
            </MenuSubmit>
            <MenuSubmit name="decision" value="bulk">
              {copy.replies.bulk}
            </MenuSubmit>
          </div>
        </Menu>
        {!answered && (
          <SubmitButton variant="ghost" size="small" fit name="decision" value="nothing">
            {copy.replies.nothing}
          </SubmitButton>
        )}
      </div>
    </FormStack>
  );
}
