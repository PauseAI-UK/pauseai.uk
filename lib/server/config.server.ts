import "server-only";

// The site's settings, from its environment variables: each is read here and
// nowhere else (an ESLint rule), and made the one shape every caller uses.
// Each is read when it's asked for, not once at start, so a test can set one
// with vi.stubEnv. Unset and empty are the same: undefined, or false.
//
// Not here: NETLIFY_DB_URL, which only lib/server/db.server.ts reads (its own ESLint
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
   * The outside services a fixture build asks for real all the same
   * (REAL_SERVICES, a list such as "photon,google-maps"), to try what they
   * answer by hand (REAL_SERVICES=photon,google-maps npm run serve). None
   * by default.
   */
  get realServices(): string[] {
    return (process.env.REAL_SERVICES ?? "").split(",").filter(Boolean);
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
  /** This deploy's own address, for siteUrl() alone (lib/site-url.server.ts; SITE_ORIGIN in next.config.ts). */
  get siteOrigin(): string | undefined {
    return value(process.env.SITE_ORIGIN);
  },
  /** Whether Google Analytics may load outside the live site: a fixture build sets ANALYTICS=1. */
  get analytics(): boolean {
    return process.env.ANALYTICS === "1";
  },

  // How this server's Node and Lambda run, for the report of it
  // (lib/oversight/node-report.server.ts), which anyone can read: names, but
  // for the runtime's own, never values.

  /** The flags in NODE_OPTIONS, by name alone (--max-old-space-size from --max-old-space-size=4096), as a value could be a secret. */
  get nodeOptionFlags(): string[] {
    return (process.env.NODE_OPTIONS ?? "")
      .split(/\s+/)
      .filter((part) => part.startsWith("-"))
      .map((flag) => flag.split("=")[0]);
  },
  /** Lambda's name for its runtime (AWS_EXECUTION_ENV), such as AWS_Lambda_nodejs24.x. */
  get lambdaRuntime(): string | undefined {
    return value(process.env.AWS_EXECUTION_ENV);
  },
  /** Whether Lambda's runtime API is set (AWS_LAMBDA_RUNTIME_API), as it is in a Lambda function. */
  get lambdaRuntimeApi(): boolean {
    return Boolean(process.env.AWS_LAMBDA_RUNTIME_API);
  },
  /** Next's runtime for this code (NEXT_RUNTIME): "nodejs" or "edge". */
  get nextRuntime(): string | undefined {
    return value(process.env.NEXT_RUNTIME);
  },
  /** The names, never the values, of the environment variables that set up Node or Lambda: NODE_* and AWS_LAMBDA_*. */
  get runtimeVariableNames(): string[] {
    return Object.keys(process.env)
      .filter((name) => /^(NODE_|AWS_LAMBDA_)/.test(name))
      .sort();
  },

  /**
   * The policy team's shared inbox (POLICY_INBOX): letters are Bcc'd to it, it
   * gets every reply to one, and its Gmail is read. Undefined where it isn't
   * set, which means none: nothing is forwarded to it or looked for in it.
   */
  get policyInbox(): string | undefined {
    return address(process.env.POLICY_INBOX);
  },
  /** The letters inbox (LETTERS_INBOX, lib/letters/letters-inbox.server.ts). */
  get lettersInbox(): string | undefined {
    return address(process.env.LETTERS_INBOX);
  },
  /** Where staff are emailed when something needs a person (lib/email/notifications.server.ts). */
  get notificationInbox(): string | undefined {
    return address(process.env.NOTIFICATION_INBOX);
  },
  /** Where the test MPs' letters go (lib/politicians/imports.server.ts). */
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
  /** The WhatsApp account's ID, which Meta calls the Messaging account ID (lib/server/outside-services/whatsapp.server.ts). */
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
  /** Our UK chapter's key to Global's CiviCRM chapter contacts API (lib/server/outside-services/civicrm.server.ts). */
  get civicrmChapterKey(): string | undefined {
    return value(process.env.CIVICRM_CHAPTER_KEY);
  },
  /** The Client ID of our Cloudflare Access service token, which every call to CiviCRM carries; trimmed, as it goes in a header. */
  get civicrmAccessClientId(): string | undefined {
    return value(process.env.CIVICRM_ACCESS_CLIENT_ID?.trim());
  },
  /** The Client Secret of the same token; trimmed, as it goes in a header. */
  get civicrmAccessClientSecret(): string | undefined {
    return value(process.env.CIVICRM_ACCESS_CLIENT_SECRET?.trim());
  },
  /** WhatsApp's permanent access token, set only on the live site, so a deploy preview can't send from the real number. */
  get whatsappToken(): string | undefined {
    return value(process.env.WHATSAPP_TOKEN);
  },
  /** The Meta app's secret, which signs WhatsApp's webhooks (X-Hub-Signature-256). */
  get whatsappAppSecret(): string | undefined {
    return value(process.env.WHATSAPP_APP_SECRET);
  },
  /** The Meta app's ID, which a template's picture is uploaded through for its approval (uploadExample). */
  get whatsappAppId(): string | undefined {
    return value(process.env.WHATSAPP_APP_ID);
  },
  /** Anthropic's API key, for Claude's judgement of the press survey's finds (lib/server/outside-services/anthropic.server.ts). */
  get anthropicApiKey(): string | undefined {
    return value(process.env.ANTHROPIC_API_KEY?.trim());
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
  /**
   * The live site's Ed25519 private key, PKCS #8 in base64, that signs a
   * login it passes on to a deploy preview (lib/accounts/google-login.server.ts).
   * Set only on the live site, so a preview can't sign one.
   */
  get googleLoginSigningKey(): string | undefined {
    return value(process.env.GOOGLE_LOGIN_SIGNING_KEY);
  },
  /** 32 random bytes, in base64, that encrypt the Gmail tokens (lib/email/gmail-tokens.server.ts). */
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
  /** What our scheduled functions send as a bearer token (lib/jobs/cron.server.ts). */
  get cronSecret(): string | undefined {
    return value(process.env.CRON_SECRET);
  },
  /** What the backup Worker sends as a bearer token (lib/jobs/cron.server.ts). */
  get backupSecret(): string | undefined {
    return value(process.env.BACKUP_SECRET);
  },
};
