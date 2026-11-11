import { Fragment } from "react";
import { FilterForm } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { mailboxes, named } from "@/lib/email-parsing/addresses";
import type { OneOffThread } from "@/lib/server/one-off-emails";
import { MessageText } from "./LetterThread";
import ThreadEmail from "./ThreadEmail";
import Grid, { Card, spanClass } from "./ui/Grid";
import StaffLink from "./ui/StaffLink";
import Withheld from "./ui/Withheld";
import styles from "./LetterThread.module.css";

const copy = staffCopy.oneOff;

type Politicians = Record<string, number>;

/** Someone on an email, the name linked to their page if they're a politician. */
function Mailbox({ name, address, politicians }: { name: string; address: string; politicians: Politicians }) {
  const politician = politicians[address];
  if (politician === undefined) return named(name, address);
  return (
    <>
      <StaffLink href={`/staff/politicians/${politician}`}>{name || address}</StaffLink>
      {name && ` <${address}>`}
    </>
  );
}

/** Everyone on a To or Cc line. */
function Mailboxes({ line, politicians }: { line: string; politicians: Politicians }) {
  return mailboxes(line).map((mailbox, i) => (
    <Fragment key={i}>
      {i > 0 && ", "}
      <Mailbox {...mailbox} politicians={politicians} />
    </Fragment>
  ));
}

/**
 * The politicians a thread shows under, each linked to their page, with a
 * button that takes them off it for good, as when an address made it look
 * theirs but it isn't.
 */
function ThreadPeople({ thread, unlink }: { thread: OneOffThread; unlink: (form: FormData) => void | Promise<void> }) {
  return (
    <Card look="aside" title={copy.people.title} id="thread-people" span={1}>
      {thread.people.length === 0 ? (
        <Muted>{copy.people.none}</Muted>
      ) : (
        <ul className={styles.people}>
          {thread.people.map((person) => (
            <li key={person.id}>
              <StaffLink href={`/staff/politicians/${person.id}`}>{person.name}</StaffLink>
              <FilterForm action={unlink} aria-label={`${copy.people.unlink}: ${person.name}`}>
                <input type="hidden" name="threadId" value={thread.id} />
                <input type="hidden" name="politicianId" value={person.id} />
                <SubmitButton variant="ghost" size="small" fit>
                  {copy.people.unlink}
                </SubmitButton>
              </FilterForm>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * A one-off thread's page: its subject, then each message as an email, a
 * forward's carried messages rebuilt before it, oldest first, each marked as
 * rebuilt; beside them, the politicians it shows under. For staff who can't
 * read it, that they can't.
 */
export default function OneOffThreadView({
  thread,
  unlink,
}: {
  thread: OneOffThread;
  unlink: (form: FormData) => void | Promise<void>;
}) {
  return (
    <>
      <h1>{thread.subject === null ? copy.title : thread.subject || copy.noSubject}</h1>
      {thread.messages_ === null ? (
        <p>
          <Withheld>{copy.hidden}</Withheld>
        </p>
      ) : (
        <Grid>
          <section aria-label={copy.thread} className={`${spanClass(3)} ${styles.thread}`}>
            {thread.messages_.map((message) => (
              <Fragment key={message.id}>
                {message.forwarded.map((rebuilt, i) => (
                  <ThreadEmail
                    key={i}
                    from={
                      <Mailbox
                        name={rebuilt.fromName}
                        address={rebuilt.fromAddress}
                        politicians={rebuilt.politicians}
                      />
                    }
                    to={<Mailboxes line={rebuilt.to} politicians={rebuilt.politicians} />}
                    cc={rebuilt.cc ? <Mailboxes line={rebuilt.cc} politicians={rebuilt.politicians} /> : null}
                    at={null}
                    sent={rebuilt.sent}
                    subject={rebuilt.subject}
                    action={<Muted>{copy.rebuilt(message.fromName || message.fromAddress)}</Muted>}
                  >
                    <MessageText text={rebuilt.text} quoted={rebuilt.quoted} />
                  </ThreadEmail>
                ))}
                <ThreadEmail
                  from={
                    <Mailbox name={message.fromName} address={message.fromAddress} politicians={message.politicians} />
                  }
                  to={<Mailboxes line={message.to} politicians={message.politicians} />}
                  cc={message.cc ? <Mailboxes line={message.cc} politicians={message.politicians} /> : null}
                  at={message.at}
                  subject={message.subject}
                >
                  {message.text === null ? (
                    <Muted>{copy.unreadable}</Muted>
                  ) : message.forwarded.length && !message.text ? (
                    <Muted>{copy.forwardedAlone}</Muted>
                  ) : (
                    <MessageText text={message.text} quoted={message.quoted} auto={message.auto} />
                  )}
                </ThreadEmail>
              </Fragment>
            ))}
          </section>
          <ThreadPeople thread={thread} unlink={unlink} />
        </Grid>
      )}
    </>
  );
}
