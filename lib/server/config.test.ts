import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("config", () => {
  it("says which build this is", () => {
    vi.stubEnv("DATA_FIXTURES", "1");
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("ANALYTICS", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect([config.fixtures, config.production, config.localBuild, config.analytics, config.nodeEnv]).toEqual([
      true,
      true,
      false,
      true,
      "development",
    ]);
    vi.stubEnv("DATA_FIXTURES", "");
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    vi.stubEnv("ANALYTICS", "0");
    expect([config.fixtures, config.production, config.localBuild, config.analytics]).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("gives every address trimmed and lowercased, and none where it's unset or blank", () => {
    vi.stubEnv("POLICY_INBOX", " Policy@Example.org ");
    vi.stubEnv("LETTERS_INBOX", "Letters@Example.org");
    vi.stubEnv("NOTIFICATION_INBOX", "alerts@example.org");
    vi.stubEnv("TEST_MP_EMAIL", "Test-MP@Example.org\n");
    expect([config.policyInbox, config.lettersInbox, config.notificationInbox, config.testMpEmail]).toEqual([
      "policy@example.org",
      "letters@example.org",
      "alerts@example.org",
      "test-mp@example.org",
    ]);
    vi.stubEnv("POLICY_INBOX", "  ");
    vi.stubEnv("LETTERS_INBOX", "");
    vi.stubEnv("NOTIFICATION_INBOX", undefined);
    expect([config.policyInbox, config.lettersInbox, config.notificationInbox]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("gives the mail domains, or ours where they're unset", () => {
    vi.stubEnv("LETTERS_MAIL_DOMAIN", "letters.example.org");
    vi.stubEnv("NOTIFY_MAIL_DOMAIN", "notify.example.org");
    expect([config.lettersMailDomain, config.notifyMailDomain]).toEqual(["letters.example.org", "notify.example.org"]);
    vi.stubEnv("LETTERS_MAIL_DOMAIN", "");
    vi.stubEnv("NOTIFY_MAIL_DOMAIN", undefined);
    expect([config.lettersMailDomain, config.notifyMailDomain]).toEqual(["letters.pauseai.uk", "notify.pauseai.uk"]);
  });

  it("gives each key and secret as set, and none where it's empty", () => {
    const settings = {
      SITE_ORIGIN: () => config.siteOrigin,
      OUTBOX_DIR: () => config.outboxDir,
      CIVICRM_CHAPTER_KEY: () => config.civicrmChapterKey,
      LUMA_WEBHOOK_SECRET: () => config.lumaWebhookSecret,
      POSTMARK_SERVER_TOKEN: () => config.postmarkServerToken,
      POSTMARK_WEBHOOK_USER: () => config.postmarkWebhookUser,
      POSTMARK_WEBHOOK_PASSWORD: () => config.postmarkWebhookPassword,
      GOOGLE_CLIENT_ID: () => config.googleClientId,
      GOOGLE_CLIENT_SECRET: () => config.googleClientSecret,
      GMAIL_TOKEN_KEY: () => config.gmailTokenKey,
      STRIPE_WALL_OF_THANKS_KEY: () => config.stripeWallOfThanksKey,
      TURNSTILE_SECRET_KEY: () => config.turnstileSecretKey,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: () => config.turnstileSiteKey,
      CRON_SECRET: () => config.cronSecret,
      BACKUP_SECRET: () => config.backupSecret,
    };
    for (const [name, read] of Object.entries(settings)) {
      // A secret is compared exactly, so its spaces are kept.
      vi.stubEnv(name, ` ${name} `);
      expect(read(), name).toBe(` ${name} `);
      vi.stubEnv(name, "");
      expect(read(), name).toBeUndefined();
    }
  });

  it("trims Luma's key, which goes in a header", () => {
    vi.stubEnv("LUMA_API_KEY", " key\n");
    expect(config.lumaApiKey).toBe("key");
    vi.stubEnv("LUMA_API_KEY", " ");
    expect(config.lumaApiKey).toBeUndefined();
    vi.stubEnv("LUMA_API_KEY", undefined);
    expect(config.lumaApiKey).toBeUndefined();
  });
});
