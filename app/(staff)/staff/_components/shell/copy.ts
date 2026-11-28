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
      events: "Outreach",
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
    press: "Press",
    import: "Scheduled jobs",
    changes: "Audit log",
    campaigns: "Campaigns",
    emails: "Correspondence",
    sentEmails: "Sent emails",
    errors: "Errors",
    // Beside a page the staff member first saw in the last 3 days.
    newTag: "new",
    supporterEmails: "Blocked addresses",
    signupUpload: "Import sign-ups",
    waitingRoom: "Waiting room",
    mpEmails: "Addresses to fix",
    logout: "Log out",
  },
  // Over any page whose button called the server after a deploy that renamed, moved or removed what it calls.
  siteUpdated: {
    title: "The site has been updated",
    words: "This page can't save or send any more. Reload it and try again.",
    kept: "Don't worry, this draft's changes are kept in the browser.",
    reload: "Reload",
    close: "Close, to copy something first",
  },
  // In place of a page that threw, beside the navigation (StaffError).
  error: {
    title: "This page hit an error",
    words: "The error has been recorded. Try again, and tell an admin if it keeps happening.",
    // The button that loads the page again.
    retry: "Try again",
  },
  // In place of a page whose record isn't there, beside the navigation (StaffNotFound): its title, and under it why.
  notFound: {
    title: "Not found",
    words: "This record isn't here. It may have been deleted, erased or merged into another.",
  },
};
