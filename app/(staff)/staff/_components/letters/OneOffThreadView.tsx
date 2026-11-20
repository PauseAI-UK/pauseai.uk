import { Fragment, type ReactNode } from "react";
import { Muted } from "@/components/ui/Text";
import { mailboxes, named } from "@/lib/email-parsing/addresses";
import { gmailMessageLink } from "@/lib/email/gmail-links";
import type { OneOffMessage, OneOffThread } from "@/lib/letters/one-off-emails.server";
import { MessageText, Thread } from "./LetterThread";
import ThreadEmail from "./ThreadEmail";
import Empty from "../ui/Empty";
import ExternalLink from "../ui/ExternalLink";
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

/** A message in the mailbox it was read from. */
const gmailLinkOf = (message: OneOffMessage) => gmailMessageLink(message.account, message.gmailMessageId);

/**
 * Under a thread's title, as under a letter's: the politician it's linked
 * to, leading to their page, where they sit and their party; or, linked to
 * several, each of them by name; or, to none, nothing.
 */
function politicianFacts(people: OneOffThread["people"]): ReactNode[] {
  const link = (person: OneOffThread["people"][number]) => (
    <StaffLink key={person.id} href={`/staff/politicians/${person.id}`}>
      {person.name}
    </StaffLink>
  );
  if (people.length === 1) return [link(people[0]), people[0].constituency, people[0].party];
  return people.map(link);
}

/**
 * A one-off thread's page: titled with who wrote in it, as a letter's page
 * is with who it's from and to, and under that the politicians it's linked
 * to (politicianFacts); then the thread, Open in Gmail at the right of its
 * heading, opening the newest message in the mailbox it was read from, where
 * Gmail shows the conversation round it; each message as an email, a
 * forward's carried messages rebuilt before it, oldest first, each marked as
 * rebuilt; beside them, the politicians it's linked to. For staff who can't
 * read it, that they can't, under the one-offs' own name.
 */
export default function OneOffThreadView({ thread }: { thread: OneOffThread }) {
  return (
    <>
      <PageHead facts={politicianFacts(thread.people)}>
        {thread.participants ? copy.between(thread.participants) : copy.title}
      </PageHead>
      {thread.messages_ === null ? (
        <p>
          <Withheld>{copy.hidden}</Withheld>
        </p>
      ) : (
        <Grid>
          <div className={spanClass(4)}>
            <Thread
              title={copy.thread}
              link={
                <ExternalLink href={gmailLinkOf(thread.messages_.at(-1)!)}>
                  {lettersCopy.lettersInbox.openInGmail}
                </ExternalLink>
              }
            >
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
                      <Mailbox
                        name={message.fromName}
                        address={message.fromAddress}
                        politicians={message.politicians}
                      />
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
            </Thread>
          </div>
          <ThreadPeople people={thread.people} />
        </Grid>
      )}
    </>
  );
}
