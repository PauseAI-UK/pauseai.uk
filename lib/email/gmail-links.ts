// Links into a Gmail mailbox, for staff signed in to it.

/**
 * A link to a message by Gmail's ID for it, in `mailbox`, for someone
 * signed in to that account: the letters inbox's, which isn't delegated.
 * By `authuser`, as Gmail answers `/mail/u/<address>/` with a 404 even for
 * an account you're signed in to.
 */
export function gmailMessageLink(mailbox: string, gmailMessageId: string): string {
  return `https://mail.google.com/mail/?${new URLSearchParams({ authuser: mailbox })}#all/${gmailMessageId}`;
}
