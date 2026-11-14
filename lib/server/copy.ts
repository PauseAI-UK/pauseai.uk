// The problems the server's own code reports (lib/server/problems.server.ts): its bindings to the outside
// services, its database, email parsing, and the public site's routes.

export const serverCopy = {
  problems: {
    // Can happen in a job or not. In a job, staff see it on the job's page and in the email. Not in a job, it's kept
    // as an error (lib/oversight/errors-seen.server.ts): on the errors page, and emailed to staff.
    anywhere: {
      // An email went by Gmail, but Gmail wouldn't say its Message-ID. Replies to it may not find their letter.
      messageIdUnknown: "Gmail wouldn't say which Message-ID an email went with",
      // Meta didn't say how many people our WhatsApp account can text a day, so the fewest are, till it does.
      whatsAppLimitUnknown: "WhatsApp didn't say our daily limit, so texts go to no more than 250 people a day",
      // Reading an email in a charset we don't know: a job reading mail, or staff opening a letter. It's read as UTF-8.
      charsetUnknown: (charset: string) =>
        `An email's charset isn't one we know, so its text may be garbled: ${charset}`,
    },
    // No job reaches these: each is kept as an error (lib/oversight/errors-seen.server.ts), on the errors page and
    // emailed to staff, but for connectionDropped and errorNotKept, which only reach Netlify's logs. Each
    // says what the person saw, if anything.
    logs: {
      // A visitor sending a letter gets an error, and the letter is lost unless they try again.
      letterNotKept: "A letter couldn't be kept",
      // A visitor is told the spam check can't be reached.
      turnstileDown: "Turnstile couldn't be reached",
      // A visitor is told the spam check isn't available.
      turnstileUnset: "TURNSTILE_SECRET_KEY isn't set",
      // A visitor is told the spam check is set up wrongly.
      turnstileTestKey: "TURNSTILE_SECRET_KEY is a Cloudflare test key, refused outside development",
      // A march sign-up that couldn't be saved here. The visitor gets Luma's answer, worked or failed.
      signUpNotKept: "A march sign-up couldn't be kept",
      // A march sign-up Luma wouldn't take. The visitor is told it failed, and their details are kept.
      lumaSkippedGuest: "Luma skipped a march sign-up: unsubscribed, removed or blocked on the calendar",
      // A march sign-up with no Luma key set. The visitor is told it failed, and their details are kept.
      lumaNotConfigured: "A march sign-up couldn't go to Luma, as LUMA_API_KEY isn't set",
      // A march sign-up Luma errored on. The visitor is told it failed, and their details are kept.
      lumaRefusedGuest: "Luma wouldn't add a march sign-up",
      // The signatories list's API answers with an error.
      signatoriesUnread: "The signatories couldn't be read",
      // A visitor looking up a postcode, or staff searching near a place, gets a failed answer.
      postcodesDown: "postcodes.io couldn't be asked",
      // The donate page shows an empty wall of thanks.
      stripeDown: "Stripe couldn't be queried, so the wall of thanks is empty",
      // A flyering tracker or the march's sign-up count shows no number.
      lumaGuestsDown: "Luma couldn't be asked about an event's guests",
      // A page that lists events shows none.
      lumaEventsDown: "Luma couldn't be asked for the events, so the page shows none",
      // An import of sign-ups registered people on Luma, and they're copied at the next scheduled run instead.
      lumaImportNotStarted: "The Luma import couldn't be started after importing sign-ups",
      // A request from Postmark or the march form that isn't JSON, treated as empty.
      badBody: (from: string) => `${from} sent a body that isn't JSON`,
      // Nobody sees anything: a warning, as the next query carries on.
      connectionDropped: "A database connection was dropped while idle",
      // An error, or a problem above, that couldn't be kept or emailed about, as the database or the email failed.
      errorNotKept: "An error couldn't be kept or emailed about",
    },
  },
};
