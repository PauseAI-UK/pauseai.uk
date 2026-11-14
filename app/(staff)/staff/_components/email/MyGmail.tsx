import { SubmitButton } from "@/components/ui/SubmitButton";
import type { GmailAccount } from "@/lib/email/gmail-accounts.server";
import { staffDate } from "@/lib/staff-time";
import { GmailConnect, GmailOutcome, SentToday } from "./GmailConnect";
import styles from "./MyGmail.module.css";
import { Card } from "../ui/Grid";
import StaffLink from "../ui/StaffLink";
import { emailCopy } from "./copy";
import { shellCopy } from "../shell/copy";

const copy = emailCopy.gmail;

/**
 * What's kept from this mailbox: all its threads with politicians, or only
 * replies to what's sent from here: mailings, and from hello@ broadcasts too.
 */
function KeptNote({ keeps, broadcasts }: { keeps: boolean; broadcasts: boolean }) {
  const words = copy;
  if (!keeps && broadcasts) {
    const both = words.notKeptBroadcasts;
    return (
      <p>
        <em>
          {both.before} <StaffLink href="/staff/mailings">{shellCopy.nav.mailings}</StaffLink> {both.and}{" "}
          <StaffLink href="/staff/broadcasts">{shellCopy.nav.broadcasts}</StaffLink>
          {both.after}
        </em>
      </p>
    );
  }
  const { before, after } = keeps ? words.kept : words.notKept;
  return (
    <p>
      <em>
        {before}{" "}
        {keeps ? (
          <StaffLink href="/staff/emails?type=one-off">{words.oneOffEmails}</StaffLink>
        ) : (
          <StaffLink href="/staff/mailings">{shellCopy.nav.mailings}</StaffLink>
        )}
        {after}
      </em>
    </p>
  );
}

/**
 * Your Gmail, a card of your own page, a third of its grid, tinted as what's beside your sessions, its title saying whether it's
 * connected, and for the letters inbox, that it sends supporters' letters: how connecting ended, if Google has just sent you back; then,
 * connected, since when and today's sends, whether threads with politicians
 * are kept from it, with Disconnect; or what
 * connecting means, and the button.
 */
export default function MyGmail({
  me,
  lettersInbox = false,
  account,
  outcome,
  disconnect,
  keepsThreads = false,
  sendsBroadcasts = false,
}: {
  /** Who's logged in. */
  me: string;
  /** Whether that's the letters inbox. */
  lettersInbox?: boolean;
  account: GmailAccount | undefined;
  /** How connecting ended, if Google has just sent you back. */
  outcome: string;
  disconnect: (form: FormData) => void | Promise<void>;
  /** Whether threads with politicians are kept from it. */
  keepsThreads?: boolean;
  /** Whether it's the address broadcasts go from, so replies to them are kept from it too. */
  sendsBroadcasts?: boolean;
}) {
  return (
    <Card
      span={2}
      look="aside"
      id="gmail"
      title={
        lettersInbox
          ? account
            ? copy.lettersInboxConnectedTitle
            : copy.lettersInboxTitle
          : account
            ? copy.connectedTitle
            : copy.title
      }
    >
      <div className={styles.body}>
        <GmailOutcome outcome={outcome} me={me} lettersInbox={lettersInbox} />
        {account ? (
          <>
            {!lettersInbox && <KeptNote keeps={keepsThreads} broadcasts={sendsBroadcasts} />}
            <p>
              {copy.connected(staffDate(account.connectedAt))}{" "}
              <SentToday sent={account.sentToday} lettersInbox={lettersInbox} />
            </p>
            <form action={disconnect}>
              <SubmitButton variant="ghost" size="small" fit>
                {copy.disconnect}
              </SubmitButton>
            </form>
          </>
        ) : (
          <GmailConnect back="/staff/me" lettersInbox={lettersInbox} />
        )}
      </div>
    </Card>
  );
}
