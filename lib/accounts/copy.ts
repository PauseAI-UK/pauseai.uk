// The words of staff accounts that the server or pure code uses, or both
// it and the staff pages: the login email, the dev login, the accounts page
// and its permissions' names, and the problems Gmail's connection reports.
// The staff pages' own are in app/(staff)/staff/_components/accounts/copy.ts.

export const accountsCopy = {
  // The dev login's box under the login card, in a fixture build only.
  devLogin: {
    // Before what a shared inbox's address is, in the dev login.
    lettersInbox: "Letters inbox",
    policyInbox: "Policy inbox",
    title: "Development only: sign in now as",
    hint: "This appears when DATA_FIXTURES=1 and never in production.",
    // Beside each address: what it may do.
    permissions: (names: string) => `${names} permissions`,
    noPermissions: "Account with no permissions",
    noAccount: "No account yet: logging in makes one",
  },
  // The email with the login link.
  loginEmail: {
    subject: "Confirm sign in to PauseAI UK",
    body: (link: string, minutes: number) =>
      `Follow this link to sign in:\n\n${link}\n\nYou must use the browser you made the link with, and it will expire after ${minutes} minutes.\n\nIf you did not request this, please ignore this message.`,
  },
  // The accounts page (/staff/accounts), for admins: who may use the staff
  // pages, and what each may do.
  accounts: {
    title: "Staff accounts",
    // Under the title.
    intro: "Who can log in and their permissions",
    // The table's last row: everyone else at pauseai.uk, who can log in with no permissions; and across the rest of
    // the row, in grey, what that means.
    everyone: "*@pauseai.uk",
    everyoneNote: "Anyone with a @pauseai.uk address can log in with no extra permissions.",
    names: {
      admin: "Admin",
      supporters: "Supporters",
    } as Record<string, string>,
    // Under the table, a heading, then after each permission's name: what it opens.
    permissionsKey: "Permissions key",
    opens: {
      supporters: "View information about supporters, include personal details.",
      admin: "Set permissions for staff accounts and view the audit log.",
    } as Record<string, string>,
    columns: {
      email: "Email",
      permissions: "Permissions",
      added: "Added",
      lastLogin: "Last login",
      lastSeen: "Last seen",
      sessions: "Sessions open",
      gmail: "Gmail",
    },
    // In the Gmail column: connected, before when; or not.
    gmailConnected: "Connected",
    gmailNot: "Not connected",
    // In the Added column, after when: who added the account, or that its first login did.
    addedBy: (who: string) => `by ${who}`,
    addedByLogin: "by login",
    // For an account that has never logged in or been seen.
    never: "Never",
    // Beside how many sessions a row has open: ends every one; on your own row, it says they're yours, as it logs you out too.
    endSessions: "End all",
    endMySessions: "End all mine",
    // At the top right, the button that opens the field for the address of someone new (its label, read aloud) and its
    // button, which adds them as a row, with no permissions.
    addStaff: "Add staff",
    // The field's label, then what's in it until something is typed.
    addLabel: "Email:",
    addTitle: "@pauseai.uk email address",
    add: "Add",
    // In a row's Permissions cell, after the permissions it has: the button that opens a box for each, and the form's
    // buttons.
    edit: "Edit",
    editLabel: (email: string) => `Edit ${email}'s permissions`,
    save: "Save",
    cancel: "Cancel",
    // At a row's right, pressed twice; and just after, over the table till its × closes it, what it leaves them.
    remove: "Remove",
    removeNote: "They will still be able to log in with basic permissions, unless their Gmail is disabled too.",
    closeRemoved: "Close",
    // Beside Add, or above the table after a Save, when the address isn't at pauseai.uk.
    notPauseai: "Only addresses @pauseai.uk can have an account.",
    // Beside Add, when the address is in the table already.
    alreadyThere: "They're in the table already.",
    // When a change would leave no admin.
    lastAdmin: "The last administrator can't be removed or lose permissions to administrate.",
  },
  // What went wrong without stopping the work (lib/server/problems.server.ts). No job reaches these: each is kept as an
  // error (lib/oversight/errors-seen.server.ts), on the errors page and emailed to staff.
  problems: {
    // Staff disconnecting their Gmail: it disconnects as normal, but Google still holds the permission.
    tokenNotRevoked: (account: string) => `${account}'s Gmail token couldn't be revoked at Google`,
  },
};
