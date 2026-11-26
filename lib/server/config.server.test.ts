import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "./config.server";

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

  it("says how Node and Lambda run, giving NODE_OPTIONS' flags and the runtime's variables by name alone", () => {
    vi.stubEnv("NODE_OPTIONS", " --max-old-space-size=4096  --require ./preload.js -r x ");
    vi.stubEnv("AWS_EXECUTION_ENV", "AWS_Lambda_nodejs24.x");
    vi.stubEnv("AWS_LAMBDA_RUNTIME_API", "127.0.0.1:9001");
    vi.stubEnv("AWS_REGION", "eu-west-2");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    expect(config.nodeOptionFlags).toEqual(["--max-old-space-size", "--require", "-r"]);
    expect([config.lambdaRuntime, config.lambdaRuntimeApi, config.nextRuntime]).toEqual([
      "AWS_Lambda_nodejs24.x",
      true,
      "nodejs",
    ]);
    expect(config.runtimeVariableNames).toEqual(expect.arrayContaining(["AWS_LAMBDA_RUNTIME_API", "NODE_OPTIONS"]));
    expect(config.runtimeVariableNames).not.toContain("AWS_REGION");
    expect(config.runtimeVariableNames).toEqual([...config.runtimeVariableNames].sort());
    vi.stubEnv("NODE_OPTIONS", undefined);
    vi.stubEnv("AWS_EXECUTION_ENV", "");
    vi.stubEnv("AWS_LAMBDA_RUNTIME_API", undefined);
    vi.stubEnv("NEXT_RUNTIME", undefined);
    expect([config.nodeOptionFlags, config.lambdaRuntime, config.lambdaRuntimeApi, config.nextRuntime]).toEqual([
      [],
      undefined,
      false,
      undefined,
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
      GOOGLE_LOGIN_SIGNING_KEY: () => config.googleLoginSigningKey,
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

  it("trims the CiviCRM Access token's parts, which go in headers", () => {
    vi.stubEnv("CIVICRM_ACCESS_CLIENT_ID", " id.access\n");
    vi.stubEnv("CIVICRM_ACCESS_CLIENT_SECRET", "secret\n");
    expect([config.civicrmAccessClientId, config.civicrmAccessClientSecret]).toEqual(["id.access", "secret"]);
    vi.stubEnv("CIVICRM_ACCESS_CLIENT_ID", " ");
    vi.stubEnv("CIVICRM_ACCESS_CLIENT_SECRET", undefined);
    expect([config.civicrmAccessClientId, config.civicrmAccessClientSecret]).toEqual([undefined, undefined]);
  });

  it("trims Anthropic's key, which goes in a header", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", " key\n");
    expect(config.anthropicApiKey).toBe("key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    expect(config.anthropicApiKey).toBeUndefined();
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
