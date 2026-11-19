import Bubble from "@/components/ui/Bubble";
import { buttonClass } from "@/components/ui/Button";
import { Muted } from "@/components/ui/Text";
import type { Block, BlockEvent } from "@/lib/oversight/blocks.server";
import StaffLink from "../ui/StaffLink";
import When from "../ui/When";
import { emailCopy } from "@/lib/email/copy";
import styles from "./BlockHistory.module.css";

const copy = emailCopy.emails;

/** A broadcast's copy's page. */
export const copyPath = (c: NonNullable<Block["copy"]>) => `/staff/broadcasts/${c.broadcast}/${c.id}`;

/** What happened, in words, with what whoever told us said, or staff's note. */
function Happened({ event }: { event: BlockEvent }) {
  if (event.what === "unblocked") {
    return (
      <>
        {copy.history.unblocked(event.by)}: <Muted>“{event.note}”</Muted>
      </>
    );
  }
  if ("copy" in event) {
    return (
      <>
        {copy.history[event.what]}: <StaffLink href={copyPath(event.copy)}>{event.copy.title}</StaffLink>
      </>
    );
  }
  return (
    <>
      {copy.kinds[event.what]}
      {event.reason && <Muted>: {event.reason}</Muted>}
      {event.mailbox && <Muted> ({copy.history.readFrom(event.mailbox)})</Muted>}
    </>
  );
}

/**
 * A row's History button, which opens a bubble of everything that
 * happened to its address or number, newest first: each bounce, complaint
 * or hold, each text WhatsApp refused or that was skipped as it had, and
 * each time staff unblocked it, with why. A row whose history is only what
 * blocked it, which the row says already, or nothing, as for a number whose
 * copies have been deleted, says it has none instead.
 */
export default function BlockHistory({ block }: { block: Pick<Block, "address" | "history"> }) {
  if (block.history.length <= 1) return <Muted>{copy.history.none}</Muted>;
  const id = `history-${block.address.replace(/\W/g, "-")}`;
  return (
    <Bubble
      id={id}
      trigger={buttonClass({ variant: "ghost", size: "small", fit: true })}
      label={copy.history.open}
      className={styles.bubble}
    >
      <ol className={styles.events} aria-label={`${copy.history.open}: ${block.address}`}>
        {block.history.map((event, i) => (
          <li key={i}>
            <Muted>
              <When at={event.at} />
            </Muted>
            <span>
              <Happened event={event} />
            </span>
          </li>
        ))}
      </ol>
    </Bubble>
  );
}
