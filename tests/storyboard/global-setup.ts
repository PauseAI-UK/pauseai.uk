import { rmSync } from "node:fs";
import {
  addTestMps,
  connectLettersInbox,
  databaseNames,
  dropDatabase,
  freshDatabase,
  runSql,
  serverSource,
} from "@/scripts/fresh-database.mjs";
import {
  FLOW_DATABASES,
  foreignServer,
  LOCAL_URL,
  OUTBOX_DIR,
  OWN_URL,
  SERVER_DATABASE,
  TEMPLATE_DATABASE,
} from "../checkout.mjs";
import {
  CHECKOUT_HEADER,
  FIXTURE_NOW,
  fixtureEnv,
  LETTERS_INBOX,
  TEST_MP_EMAIL,
} from "@/lib/server/fixtures/fixture-env.mjs";

// Before the flows, the server on this checkout's own port, which Playwright
// reuses whatever it is, must be this checkout's build: another checkout's,
// left running, would be tested in its place. A server named with LOCAL_URL
// (--server, or main's in the review) is taken as it is.
//
// Then the template database each flow's is copied from
// (fixtures.ts), migrated and with the test MPs, as the build's own database
// is made, with the letters inbox connected. Flows that need the fixture politicians sync them in themselves
// (importPoliticians in politician-steps.ts).
//
// The server's clock is fixed at FIXTURE_NOW (lib/now.ts); so is the
// database's: a now() in a `fixture` schema, which each flow's database puts
// first on its search path, and which the columns that default to now() use.
// So a letter's sent time and an audit entry's time are the same on every
// run, and the storyboard compares those pages unmasked.
export default async function globalSetup(): Promise<void> {
  if (LOCAL_URL === OWN_URL) {
    const res = await fetch(OWN_URL, { method: "HEAD", redirect: "manual" });
    const foreign = foreignServer(res.headers.get(CHECKOUT_HEADER));
    if (foreign) throw new Error(foreign);
    // The build's own database is on the Postgres it was started with. Not
    // there, the build is on another (one from before this checkout had its
    // own), and wouldn't find the flows' databases.
    if (!databaseNames(SERVER_DATABASE).includes(SERVER_DATABASE))
      throw new Error(
        `${OWN_URL} was started on another Postgres than ${serverSource()}. Stop that server and run again.`,
      );
  }

  // Left over from this checkout's run that was stopped: nothing can be using them now.
  for (const name of databaseNames(FLOW_DATABASES)) dropDatabase(name);

  // A minute before the migrations start, so that every row they write is after it, whatever the clocks.
  const migrating = new Date(Date.now() - 60_000).toISOString();
  const url = freshDatabase(TEMPLATE_DATABASE);
  addTestMps(url, TEST_MP_EMAIL);
  // Letters go from the letters inbox, so every flow has it connected.
  connectLettersInbox(url, LETTERS_INBOX, fixtureEnv({ outboxDir: OUTBOX_DIR }).GMAIL_TOKEN_KEY);
  runSql(
    TEMPLATE_DATABASE,
    `CREATE SCHEMA fixture;
     CREATE FUNCTION fixture.now() RETURNS timestamptz LANGUAGE sql IMMUTABLE
       AS $$ SELECT '${FIXTURE_NOW}'::timestamptz $$;
     DO $$
     DECLARE col record;
     BEGIN
       FOR col IN SELECT table_name, column_name FROM information_schema.columns
                  WHERE table_schema = 'public' AND column_default = 'now()'
       LOOP
         EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT fixture.now()', col.table_name, col.column_name);
         -- The rows the migrations wrote got the real clock's time, which changes from one day's run to the next.
         -- A time a migration set on purpose, such as an old mailing's, is older than the migrations, and stays.
         EXECUTE format('UPDATE public.%I SET %I = fixture.now() WHERE %I >= %L', col.table_name, col.column_name,
           col.column_name, '${migrating}');
       END LOOP;
     END $$;
     UPDATE staff_accounts SET gmail_connected_at = CASE WHEN gmail_token IS NOT NULL THEN fixture.now() END
      WHERE added_by = 'migration';`,
  );

  // The outbox fills up over runs, and every email in it is read each time a flow looks.
  rmSync(OUTBOX_DIR, { recursive: true, force: true });
}
