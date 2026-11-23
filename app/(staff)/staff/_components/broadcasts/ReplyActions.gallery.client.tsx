"use client";

// ReplyActions' examples, which log what's pressed (ReplyActions.gallery.tsx, and OptOutForm's in supporters/).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import ReplyActions from "./ReplyActions";

/** What to record a reply as, under it: to an email, or to a text (`text`). */
export function ReplyActionsExample({ write = false, text = false }: { write?: boolean; text?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <ReplyActions
          replyId={1}
          topics={["newsletter", "events"]}
          deal={log("deal")}
          text={text}
          write={write ? () => log("write")() : undefined}
        />
      )}
    </Logged>
  );
}
