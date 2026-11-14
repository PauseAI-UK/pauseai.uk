// The words of the staff pages' frame: the sidebar, with each page's name.

export const shellCopy = {
  nav: {
    // At the left of the bar, and the way to the home page.
    title: "PauseAI Staff",
    // The round button on the sidebar's edge, by its title, that folds it to a strip, and back, for a screen reader.
    fold: "Fold the menu",
    unfold: "Unfold the menu",
    home: "Dashboard",
    accounts: "Staff accounts",
    // The sections the pages are in, in the sidebar.
    sections: {
      supporters: "Supporters",
      events: "Events",
      politicians: "Politicians",
      admin: "Admin",
      // Over your address, which leads to your own page.
      profile: "Your account",
    } as Record<string, string>,
    supporters: "Supporters",
    politicians: "Politicians",
    asks: "Asks",
    mailings: "Mailings",
    broadcasts: "Broadcasts",
    events: "Events",
    import: "Scheduled jobs",
    changes: "Audit log",
    campaigns: "Campaigns",
    emails: "Correspondence",
    sentEmails: "Sent emails",
    errors: "Errors",
    // Beside a page the staff member first saw in the last 3 days.
    newTag: "new",
    draftTag: "draft",
    supporterEmails: "Bounced emails",
    signupUpload: "Import sign-ups",
    mpEmails: "Addresses to fix",
    logout: "Log out",
  },
};
