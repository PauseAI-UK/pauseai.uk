import "server-only";

// The site's settings, from its environment variables: each is read here and
// nowhere else (an ESLint rule), and made the one shape every caller uses.
// Each is read when it's asked for, not once at start, so a test can set one
// with vi.stubEnv. Unset and empty are the same: undefined, or false.
//
// Not here: NETLIFY_DB_URL, which only lib/server/db.ts reads (its own ESLint
// rule); FIXTURE_NOW, which lib/now.ts reads, as it runs in the browser too;
// and the fixture build's own folders, which the fakes in lib/server/fixtures/
// read, as the storyboard loads them outside the site.

/** The variable, or undefined if it's unset or empty. */
function value(raw: string | undefined): string | undefined {
  return raw || undefined;
}

/**
 * An email address: trimmed and lowercased, as every address we compare
 * against is (docs/code-structure.md, "SQL"), so `===` is enough.
 */
function address(raw: string | undefined): string | undefined {
  return raw?.trim().toLowerCase() || undefined;
}

export const config = {
  /** A fixture build (DATA_FIXTURES=1): every outside service faked, and the dev login and gallery on. Never on the live site. */
  get fixtures(): boolean {
    return process.env.DATA_FIXTURES === "1";
  },
  /**
   * The live site: Netlify's deploy context is "production". DEPLOY_CONTEXT is
   * Netlify's CONTEXT, fixed at build time by next.config.ts.
   */
  get production(): boolean {
    return process.env.DEPLOY_CONTEXT === "production";
  },
  /** A build Netlify didn't make (next.config.ts sets DEPLOY_CONTEXT to "local"). */
  get localBuild(): boolean {
    return process.env.DEPLOY_CONTEXT === "local";
  },
  /** Next's NODE_ENV: "development" in the dev server, "test" in Vitest, else "production". */
  get nodeEnv(): string | undefined {
    return process.env.NODE_ENV;
  },
  /** This deploy's own address, for siteUrl() alone (lib/site-url.ts; SITE_ORIGIN in next.config.ts). */
  get siteOrigin(): string | undefined {
    return value(process.env.SITE_ORIGIN);
  },
  /** Whether Google Analytics may load outside the live site: a fixture build sets ANALYTICS=1. */
  get analytics(): boolean {
    return process.env.ANALYTICS === "1";
  },

  /**
   * The policy team's shared inbox (POLICY_INBOX): letters are Bcc'd to it, it
   * gets every reply to one, and its Gmail is read. Undefined where it isn't
   * set, which means none: nothing is forwarded to it or looked for in it.
   */
  get policyInbox(): string | undefined {
    return address(process.env.POLICY_INBOX);
  },
  /** The letters inbox (LETTERS_INBOX, lib/server/letters-inbox.ts). */
  get lettersInbox(): string | undefined {
    return address(process.env.LETTERS_INBOX);
  },
  /** Where staff are emailed when something needs a person (lib/server/notifications.ts). */
  get notificationInbox(): string | undefined {
    return address(process.env.NOTIFICATION_INBOX);
  },
  /** Where the test MPs' letters go (lib/server/politician-import.ts). */
  get testMpEmail(): string | undefined {
    return address(process.env.TEST_MP_EMAIL);
  },
  /** Letters to representatives are sent from this domain, and replies come back to it. */
  get lettersMailDomain(): string {
    return value(process.env.LETTERS_MAIL_DOMAIN) ?? "letters.pauseai.uk";
  },
  /** The site's other email, such as forwarded replies, is sent from this domain. */
  get notifyMailDomain(): string {
    return value(process.env.NOTIFY_MAIL_DOMAIN) ?? "notify.pauseai.uk";
  },
  /** The WhatsApp account's ID, which Meta calls the Messaging account ID (lib/server/outside-services/whatsapp.ts). */
  get whatsappAccountId(): string | undefined {
    return value(process.env.WHATSAPP_ACCOUNT_ID);
  },
  /** Where an email that isn't really sent is written (lib/server/fixtures/outbox.ts). */
  get outboxDir(): string | undefined {
    return value(process.env.OUTBOX_DIR);
  },

  // Keys and secrets, as set: a secret another service sends back is compared
  // exactly. Luma's key is trimmed, as it goes in a header, which is trimmed
  // anyway.
  /** Our UK chapter's key to Global's CiviCRM chapter contacts API (lib/server/outside-services/civicrm.ts). */
  get civicrmChapterKey(): string | undefined {
    return value(process.env.CIVICRM_CHAPTER_KEY);
  },
  /** WhatsApp's permanent access token, set only on the live site, so a deploy preview can't send from the real number. */
  get whatsappToken(): string | undefined {
    return value(process.env.WHATSAPP_TOKEN);
  },
  /** The Meta app's secret, which signs WhatsApp's webhooks (X-Hub-Signature-256). */
  get whatsappAppSecret(): string | undefined {
    return value(process.env.WHATSAPP_APP_SECRET);
  },
  get lumaApiKey(): string | undefined {
    return value(process.env.LUMA_API_KEY?.trim());
  },
  get lumaWebhookSecret(): string | undefined {
    return value(process.env.LUMA_WEBHOOK_SECRET);
  },
  get postmarkServerToken(): string | undefined {
    return value(process.env.POSTMARK_SERVER_TOKEN);
  },
  get postmarkWebhookUser(): string | undefined {
    return value(process.env.POSTMARK_WEBHOOK_USER);
  },
  get postmarkWebhookPassword(): string | undefined {
    return value(process.env.POSTMARK_WEBHOOK_PASSWORD);
  },
  get googleClientId(): string | undefined {
    return value(process.env.GOOGLE_CLIENT_ID);
  },
  get googleClientSecret(): string | undefined {
    return value(process.env.GOOGLE_CLIENT_SECRET);
  },
  /** 32 random bytes, in base64, that encrypt the Gmail tokens (lib/accounts/gmail-tokens.ts). */
  get gmailTokenKey(): string | undefined {
    return value(process.env.GMAIL_TOKEN_KEY);
  },
  get stripeWallOfThanksKey(): string | undefined {
    return value(process.env.STRIPE_WALL_OF_THANKS_KEY);
  },
  get turnstileSecretKey(): string | undefined {
    return value(process.env.TURNSTILE_SECRET_KEY);
  },
  /** Turnstile's site key, which the browser draws the widget with; Next writes it into the build. */
  get turnstileSiteKey(): string | undefined {
    return value(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  },
  /** What our scheduled functions send as a bearer token (lib/server/cron.ts). */
  get cronSecret(): string | undefined {
    return value(process.env.CRON_SECRET);
  },
  /** What the backup Worker sends as a bearer token (lib/server/cron.ts). */
  get backupSecret(): string | undefined {
    return value(process.env.BACKUP_SECRET);
  },
};
