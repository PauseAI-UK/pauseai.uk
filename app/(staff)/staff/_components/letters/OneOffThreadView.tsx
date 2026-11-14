import { Fragment } from "react";
import { Muted } from "@/components/ui/Text";
import { mailboxes, named } from "@/lib/email-parsing/addresses";
import type { OneOffThread } from "@/lib/letters/one-off-emails.server";
import { MessageText } from "./LetterThread";
import ThreadEmail from "./ThreadEmail";
import { staffTime } from "@/lib/staff-time";
import Empty from "../ui/Empty";
import Grid, { Card, spanClass } from "../ui/Grid";
import PageHead from "../ui/PageHead";
import StaffLink from "../ui/StaffLink";
import Withheld from "../ui/Withheld";
import styles from "./LetterThread.module.css";
import { lettersCopy } from "./copy";

const copy = lettersCopy.oneOff;

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
 * The politicians a thread is linked to, each linked to their page: also
 * those it names only in what it quotes, which its headers don't show.
 */
function ThreadPeople({ people }: { people: OneOffThread["people"] }) {
  return (
    <Card look="aside" title={copy.people.title} id="thread-people" span={2}>
      {people.length === 0 ? (
        <Empty>{copy.people.none}</Empty>
      ) : (
        <ul className={styles.people}>
          {people.map((person) => (
            <li key={person.id}>
              <StaffLink href={`/staff/politicians/${person.id}`}>{person.name}</StaffLink>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * A one-off thread's page: titled with who wrote in it, as a letter's page
 * is with who it's from and to, and under that what the list of threads
 * says of it (its subject, the mailbox it was read from, how many messages,
 * when the last came); then each message as an email, a forward's carried
 * messages rebuilt before it, oldest first, each marked as rebuilt; beside
 * them, the politicians it's linked to. For staff who can't read it, that
 * they can't, under the one-offs' own name.
 */
export default function OneOffThreadView({ thread }: { thread: OneOffThread }) {
  return (
    <>
      <PageHead
        facts={[
          thread.subject !== null && copy.fact(copy.columns.subject, thread.subject || copy.noSubject),
          thread.mailboxes && copy.fact(copy.columns.mailbox, thread.mailboxes.join(", ")),
          copy.fact(copy.columns.messages, thread.messages),
          copy.fact(copy.columns.when, staffTime(thread.latestAt)),
        ]}
      >
        {thread.participants ? copy.between(thread.participants) : copy.title}
      </PageHead>
      {thread.messages_ === null ? (
        <p>
          <Withheld>{copy.hidden}</Withheld>
        </p>
      ) : (
        <Grid>
          <section aria-label={copy.thread} className={`${spanClass(4)} ${styles.thread}`}>
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
                    to={rebuilt.to ? <Mailboxes line={rebuilt.to} politicians={rebuilt.politicians} /> : null}
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
          <ThreadPeople people={thread.people} />
        </Grid>
      )}
    </>
  );
}
