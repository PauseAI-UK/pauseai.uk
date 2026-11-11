import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addFixtureData,
  addTestMps,
  copyDatabase,
  databaseNames,
  defaultHost,
  dropDatabase,
  freshDatabase,
  isLocal,
  noServer,
  resetDatabase,
  runSql,
  serverSource,
  testServerUrl,
} from "./fresh-database.mjs";

describe("isLocal", () => {
  it("accepts databases on this machine, and nothing else", () => {
    for (const url of [
      "postgresql://localhost/a",
      "postgresql://127.0.0.1:5433/a",
      "postgresql://[::1]/a",
      "postgresql:///a?host=/tmp",
      "postgresql://x@localhost/a?host=%2Fvar%2Frun%2Fpostgresql",
    ]) {
      expect(isLocal(url), url).toBe(true);
    }
    for (const url of [
      "postgresql://u:p@ep-cool.eu-central-1.aws.neon.tech/neondb",
      "postgresql://localhost/a?host=db.example.org",
    ]) {
      expect(isLocal(url), url).toBe(false);
    }
  });
});

describe("defaultHost", () => {
  it("finds the first directory with the server's socket, or falls back to localhost", () => {
    const linux = mkdtempSync(join(tmpdir(), "pg-"));
    const mac = mkdtempSync(join(tmpdir(), "pg-"));
    try {
      writeFileSync(join(mac, ".s.PGSQL.5432"), "");
      expect(defaultHost("5432", [linux, mac])).toBe(mac);
      expect(defaultHost("5433", [linux, mac])).toBe("localhost");
    } finally {
      rmSync(linux, { recursive: true });
      rmSync(mac, { recursive: true });
    }
  });
});

describe("testServerUrl", () => {
  it("prefers the environment, then .env.local, reading only that line", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"));
    const file = join(dir, ".env.local");
    try {
      writeFileSync(
        file,
        'DATA_FIXTURES=1\n# TEST_DATABASE_URL=commented\n TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/postgres" \n',
      );
      expect(testServerUrl({ TEST_DATABASE_URL: "postgresql://env/x" }, file)).toBe("postgresql://env/x");
      expect(testServerUrl({}, file)).toBe("postgresql://postgres:postgres@localhost:5433/postgres");
      writeFileSync(file, "DATA_FIXTURES=1\n");
      expect(testServerUrl({}, file)).toBeUndefined();
      expect(testServerUrl({}, join(dir, "missing"))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("serverSource and noServer", () => {
  it("say where the server was looked for, and what to do when none answers", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-"));
    const file = join(dir, ".env.local");
    try {
      expect(serverSource({ TEST_DATABASE_URL: "postgresql://env/x" }, file)).toBe(
        "TEST_DATABASE_URL in the environment",
      );
      writeFileSync(file, "TEST_DATABASE_URL=postgresql://localhost:5433/postgres\n");
      expect(serverSource({}, file)).toBe(`TEST_DATABASE_URL in ${file}`);
      rmSync(file);
      expect(serverSource({ PGHOST: "/run/pg" }, file)).toBe("PGHOST, /run/pg");
      expect(serverSource({}, file, [dir])).toBe("localhost, with no server's socket in /var/run/postgresql or /tmp");
      writeFileSync(join(dir, ".s.PGSQL.5432"), "");
      expect(serverSource({}, file, [dir])).toBe(`the socket in ${dir}`);
    } finally {
      rmSync(dir, { recursive: true });
    }
    const said = noServer("postgresql://u:secret@localhost:5433/postgres", "TEST_DATABASE_URL in the environment");
    expect(said).toContain("No Postgres answered at postgresql://u@localhost:5433/postgres");
    expect(said).not.toContain("secret");
    expect(said).toContain("pg-start");
    expect(noServer("postgresql://localhost/postgres")).toContain("(");
  });
});

describe.skipIf(process.env.NETLIFY === "true")("copying a database", () => {
  it("says what to do when no server answers", () => {
    expect(() => resetDatabase("postgresql://nobody@localhost:1/test_nowhere")).toThrow(/No Postgres answered at/);
  });

  const template = `test_${process.pid}_template`;
  const copy = `test_${process.pid}_copy`;

  // Makes, copies and drops databases in psql, so it gets MAKES_DATABASES's
  // timeout (tests/database.ts, which this file, testing what that one is
  // built on, doesn't import).
  it(
    "makes a database with production's collation, copies it, runs SQL in the copy, holds a job's lock, lists and drops them, and refuses bad names",
    { timeout: 30_000 },
    async () => {
      try {
        freshDatabase(template);
        runSql(template, "INSERT INTO audit_log (actor, action) VALUES ('a', 'kept')");
        copyDatabase(copy, template);
        expect(runSql(copy, "SELECT actor, action FROM audit_log")).toEqual(["a\tkept"]);
        // Production's collation, whatever the server's own, in the copy too: by code point.
        const locale =
          "SELECT datlocprovider, datcollate, datlocale FROM pg_database WHERE datname = current_database()";
        expect(runSql(copy, locale)).toEqual(["b\tC.UTF-8\tC.UTF-8"]);
        expect(
          runSql(copy, "SELECT string_agg(x, ' ' ORDER BY x) FROM (VALUES ('apple'), ('Zack'), ('Émile')) v(x)"),
        ).toEqual(["Zack apple Émile"]);
        expect(runSql(copy, "SELECT 1 WHERE false")).toEqual([]);
        expect(databaseNames(`test_${process.pid}_`)).toEqual([copy, template]);
        expect(() => copyDatabase("bad name", template)).toThrow("Bad database name: bad name");
        expect(() => runSql("x;drop", "SELECT 1")).toThrow("Bad database name");
        expect(() => databaseNames("x'")).toThrow("Bad database name");
      } finally {
        dropDatabase(copy);
        dropDatabase(template);
      }
      expect(databaseNames(`test_${process.pid}_`)).toEqual([]);
    },
  );

  it(
    "adds the test MPs and the fake data: every table filled, supporters one per email, and every dashboard number in both weeks",
    { timeout: 30_000 },
    () => {
      const name = `test_${process.pid}_fixtures`;
      try {
        const url = freshDatabase(name);
        addTestMps(url, "mp@example.org");
        addFixtureData(url);
        // Every table has rows, bar the migrations' own record.
        const tables = runSql(
          name,
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations' ORDER BY 1",
        );
        expect(tables.length).toBeGreaterThan(15);
        for (const table of tables) expect(runSql(name, `SELECT count(*) FROM ${table}`), table).not.toEqual(["0"]);
        // Each kept reply's message is there to read.
        for (const key of runSql(name, "SELECT blob_key FROM letter_replies")) {
          const file = key.replace(/^fixture\/(.+)\.gz$/, "$1");
          expect(existsSync(join(process.cwd(), "lib/server/fixtures/letter-replies", file)), key).toBe(true);
        }
        // Every letter to Polly Placeholder that's replied to has its reply and its own text kept.
        expect(
          runSql(
            name,
            `SELECT l.id FROM letters l JOIN notable_people n ON n.id = l.notable_person_id
               JOIN letters_from_supporters s ON s.id = l.id
             WHERE n.airtable_id = 'recPlaceholder' AND l.replied_at IS NOT NULL
               AND (s.letter IS NULL OR NOT EXISTS (SELECT 1 FROM letter_replies r WHERE r.letter_id = l.id AND r.at = l.replied_at))`,
          ),
        ).toEqual([]);
        // Messages by email and by text, each in every state a mailing has.
        expect(
          runSql(
            name,
            "SELECT channel || ' ' || state FROM mailings WHERE audience = 'supporters' GROUP BY channel, state ORDER BY 1",
          ),
        ).toEqual(
          ["email", "text"].flatMap((channel) =>
            ["cancelled", "draft", "scheduled", "sending", "sent"].map((state) => `${channel} ${state}`),
          ),
        );
        // No two politicians share a name, so a list of them never shows the same row twice.
        expect(runSql(name, "SELECT name FROM notable_people GROUP BY name HAVING count(*) > 1")).toEqual([]);
        // One supporter per email, but Dana and Robin, each two emails merged by a mobile, with nothing left
        // unlinked, and every kind of supporter among them.
        expect(runSql(name, "SELECT count(*) FROM supporters")).toEqual(
          runSql(name, "SELECT count(DISTINCT supporter_id) FROM supporter_links"),
        );
        expect(
          runSql(
            name,
            `SELECT DISTINCT i.name FROM supporter_identity i WHERE i.supporter_id IN
               (SELECT supporter_id FROM supporter_links GROUP BY supporter_id HAVING count(DISTINCT matched_value) > 1)
             ORDER BY 1`,
          ),
        ).toEqual(["Dana Double", "Robin Rivers"]);
        expect(
          runSql(
            name,
            "SELECT count(*) FROM luma_people p WHERE NOT EXISTS (SELECT 1 FROM supporter_links l WHERE l.luma_user_id = p.user_id)",
          ),
        ).toEqual(["0"]);
        expect(
          runSql(
            name,
            "SELECT count(*) FROM form_entries f WHERE NOT EXISTS (SELECT 1 FROM supporter_links l WHERE l.form_entry_id = f.id)",
          ),
        ).toEqual(["0"]);
        expect(
          runSql(
            name,
            "SELECT count(*) FROM airtable_members m WHERE NOT EXISTS (SELECT 1 FROM supporter_links l WHERE l.airtable_member_id = m.id)",
          ),
        ).toEqual(["0"]);
        // Sorted byte by byte, so the order is the same whatever the database's collation.
        expect(
          runSql(
            name,
            'SELECT s FROM (SELECT DISTINCT sources::text AS s FROM supporters_summary) d ORDER BY s COLLATE "C"',
          ),
        ).toEqual([
          "{airtable,civicrm,email-your-mp,luma}",
          "{airtable,civicrm,luma}",
          "{airtable,civicrm}",
          "{airtable,email-your-mp}",
          "{airtable,luma}",
          "{airtable}",
          "{civicrm}",
          "{email-your-mp,luma,march-2026-11}",
          "{email-your-mp,luma}",
          "{email-your-mp}",
          "{luma}",
          "{march-2026-11}",
          "{paper-signup}",
          "{web-form}",
        ]);
        // Letters in every state, and every kind of event about them.
        expect(runSql(name, "SELECT DISTINCT status FROM letters ORDER BY 1")).toEqual([
          "bounced",
          "cancelled",
          "not_sent",
          "queued",
          "scheduled",
          "sending",
          "sent",
          "skipped",
          "spam_complaint",
        ]);
        expect(runSql(name, "SELECT DISTINCT status FROM letter_events ORDER BY 1")).toEqual([
          "auto_reply",
          "bounced",
          "copy_sent",
          "failed",
          "queued",
          "relayed",
          "replied",
          "sending",
          "sent",
          "skipped",
          "spam_complaint",
        ]);
        expect(runSql(name, "SELECT DISTINCT kind FROM email_problems ORDER BY 1")).toEqual([
          "complaint",
          "hard",
          "hold",
          "soft",
        ]);
        expect(runSql(name, "SELECT DISTINCT outcome FROM email_sends ORDER BY 1")).toEqual([
          "failed",
          "refused",
          "sent",
        ]);
        // Every job's run in every state.
        expect(runSql(name, "SELECT DISTINCT job FROM import_runs ORDER BY 1")).toEqual([
          "check-mps",
          "import-civicrm",
          "import-controlai",
          "import-luma",
          "import-members",
          "import-old-letters",
          "import-web-form-letters",
          "read-gmail",
          "sync-emails",
          "sync-politicians",
        ]);
        // Politicians in every state and every body, and two whose records are gone from Airtable.
        expect(runSql(name, "SELECT DISTINCT status FROM notable_people ORDER BY 1")).toEqual([
          "died",
          "in_office",
          "left_office",
          "retired",
        ]);
        expect(runSql(name, "SELECT DISTINCT house FROM politicians ORDER BY 1")).toEqual([
          "commons",
          "lords",
          "ni-assembly",
          "other",
          "scottish-parliament",
          "senedd",
        ]);
        expect(runSql(name, "SELECT count(*) FROM notable_people WHERE airtable_removed_at IS NOT NULL")).toEqual([
          "2",
        ]);
        // Every answer to every kind of ask, and each import's and staff's.
        expect(runSql(name, "SELECT DISTINCT ask_kind || ' ' || status FROM ask_statuses ORDER BY 1")).toEqual([
          "event declined",
          "event going",
          "event other",
          "letter declined",
          "letter other",
          "letter signed",
        ]);
        expect(
          runSql(
            name,
            "SELECT DISTINCT CASE WHEN updated_by LIKE '%@%' THEN 'staff' ELSE updated_by END FROM ask_statuses ORDER BY 1",
          ),
        ).toEqual(["airtable", "controlai", "staff", "sync"]);
        // Letters of both kinds: a supporter's through the site and through the old form, and PauseAI's of each mailing to politicians but a draft.
        expect(
          runSql(
            name,
            "SELECT DISTINCT kind || ' ' || (airtable_id IS NOT NULL) FROM letters_from_supporters ORDER BY 1",
          ),
        ).toEqual(["supporter false", "supporter true"]);
        expect(
          runSql(
            name,
            "SELECT count(DISTINCT mailing_id) = (SELECT count(*) FROM mailings WHERE audience = 'politicians' AND state <> 'draft') FROM letters_from_pauseai",
          ),
        ).toEqual(["t"]);
        // Mailings written here in every state but those a stop makes, to supporters too.
        expect(
          runSql(name, "SELECT DISTINCT audience || ' ' || state FROM mailings WHERE body IS NOT NULL ORDER BY 1"),
        ).toEqual([
          "politicians cancelled",
          "politicians draft",
          "politicians scheduled",
          "politicians sending",
          "politicians sent",
          "supporters cancelled",
          "supporters draft",
          "supporters scheduled",
          "supporters sending",
          "supporters sent",
        ]);
        // Opt-outs told by every source, and every answer to whether we'd email someone.
        expect(runSql(name, "SELECT DISTINCT list || ' ' || source FROM opt_outs ORDER BY 1")).toEqual([
          "events luma-contacts",
          "events luma-webhook",
          "newsletter civicrm",
        ]);
        expect(runSql(name, "SELECT DISTINCT send || ' ' || reason FROM email_permissions ORDER BY 1")).toEqual([
          "no blocked",
          "no declined",
          "no left",
          "no no-bulk-email",
          "no not-following",
          "no not-opted-in",
          "no unsubscribed",
          "yes asked",
          "yes following",
          "yes signed-up",
          "yes subscribed",
        ]);
        // Every way a broadcast's copy can go, and each agrees with its supporter's consent now: a copy still
        // to send says yes; one skipped as blocked or unsubscribed, bounced, or stopped after it arrived says
        // that no.
        expect(
          runSql(name, "SELECT DISTINCT status || ' ' || coalesce(skip_reason, '') FROM broadcast_messages ORDER BY 1"),
        ).toEqual([
          "cancelled ",
          "delivered ",
          "failed ",
          "scheduled ",
          "sent ",
          "skipped blocked",
          "skipped no-permission",
          "skipped not-on-whatsapp",
          "skipped unsubscribed",
        ]);
        expect(
          runSql(
            name,
            `SELECT c.id || ' ' || p.send || ' ' || p.reason FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id,
               contact_permission(m.topic, CASE m.channel WHEN 'email' THEN 'email' ELSE 'text' END, c.address) p
             WHERE CASE
               WHEN c.status = 'scheduled' THEN p.send <> 'yes'
               WHEN c.skip_reason IN ('blocked', 'unsubscribed') THEN p.reason <> c.skip_reason
               WHEN c.skip_reason = 'no-permission' THEN p.send = 'yes'
               WHEN EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'bounced') THEN p.reason <> 'blocked'
               WHEN EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'opted-out') THEN p.reason <> 'unsubscribed'
               ELSE false END`,
          ),
        ).toEqual([]);
        expect(runSql(name, "SELECT DISTINCT status FROM import_runs ORDER BY 1")).toEqual([
          "applied",
          "discarded",
          "failed",
          "held",
          "ok",
          "unchanged",
        ]);
        expect(
          runSql(name, "SELECT DISTINCT result->>'stoppedBy' FROM import_runs WHERE result ? 'stoppedBy' ORDER BY 1"),
        ).toEqual(["gmail", "rate-limit", "running", "time"]);
        // The audit log's entries about politicians name their rows.
        expect(
          runSql(
            name,
            "SELECT count(*) FROM audit_log a WHERE action IN ('set status', 'edit politician') AND NOT EXISTS (SELECT 1 FROM politicians p WHERE p.id = coalesce(a.details->>'politicianId', a.details->>'id')::bigint)",
          ),
        ).toEqual(["0"]);
        // Every dashboard number: at least one in the last week and in the week before, and not all the same way.
        const windows = {
          lettersSent: ["letters WHERE sent_at IS NOT NULL", "sent_at"],
          lettersReplied: ["letters WHERE replied_at IS NOT NULL", "replied_at"],
          lettersBounced: ["letter_events WHERE status = 'bounced'", "at"],
          mpsSigned: ["ask_statuses WHERE status = 'signed'", "updated_at"],
          supportersAdded: ["supporters WHERE true", "created_at"],
          eventRegistrations: [
            "luma_guests WHERE approval_status = 'approved' AND removed_at IS NULL",
            "registered_at",
          ],
          unsubscribes: ["opt_outs WHERE resubscribed_at IS NULL", "unsubscribed_at"],
          addressesBlocked: ["email_blocks b JOIN email_problems p ON p.id = b.problem_id WHERE true", "p.at"],
        };
        const changes = Object.entries(windows).map(([metric, [from, at]]) => {
          const [week, previous] = runSql(
            name,
            `SELECT (SELECT count(*) FROM ${from} AND ${at} >= now() - interval '7 days'), (SELECT count(*) FROM ${from} AND ${at} >= now() - interval '14 days' AND ${at} < now() - interval '7 days')`,
          )[0]
            .split("\t")
            .map(Number);
          expect(week, `${metric} this week`).toBeGreaterThan(0);
          expect(previous, `${metric} the week before`).toBeGreaterThan(0);
          return Math.sign(week - previous);
        });
        expect(changes).toContain(1);
        expect(changes).toContain(-1);
      } finally {
        dropDatabase(name);
      }
    },
  );
});
