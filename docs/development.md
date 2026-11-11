# Local development

How to set up and run everything on your own machine: the site, the
database, Email your MP, the staff interface, and the tests. The README has
the short version, and `.env.example` lists the environment variables.

## 1. What you need

- **Node 24**, at 24.22.1 or later. It's the version in `.nvmrc`, which
  Netlify and CI use too. `npm install` refuses anything else (`engines` in
  `package.json`, with `engine-strict` in `.npmrc`).
- **Docker**, to run Postgres 18 from `docker-compose.yml`. That matches
  production: Netlify Database runs PostgreSQL 18, and CI uses 18 too. You
  can use a Postgres 18 installed natively instead (below).
- **`psql`**, Postgres's command-line tool, on your path. The scripts use it
  to make databases and apply migrations.
- **Chromium for Playwright**, for the browser tests:
  `npx playwright install chromium`.

You don't need the Netlify CLI. The site runs with plain `npm run dev`.

## 2. Install

```bash
git clone https://github.com/PauseAI-UK/pauseai.uk.git
cd pauseai.uk
npm install
```

Optionally, `npm run hooks:install` sets up Git hooks, with
[prek](https://prek.j178.dev/):

- On a commit, one runs Prettier, ESLint and Stylelint on the files you
  commit, in a couple of seconds, and stops the commit if they fail.
  Prettier formats the files itself, so after it stops a commit, `git add`
  them and commit again.
- After a checkout or a merge, another writes `investments/ranked.txt`
  again.
- Before a push, two more check the migrations ("Adding a migration",
  below).

The hooks are in `.pre-commit-config.yaml`. CI runs the checks and more
either way. Git doesn't copy hooks with a clone, so each clone needs this
once. Its worktrees share them.

### Worktrees

To work on a branch beside another, give it a worktree of its own:

```bash
npm run worktree -- fix-footer
```

That:

1. fetches;
2. adds `tmp/worktrees/fix-footer` under the main checkout, as a new branch
   from `origin/main` (the folder is gitignored);
3. runs `npm ci` there;
4. prints the ports its storyboard will use.

Each checkout has its own databases, outboxes and ports for the storyboard
(`tests/checkout.mjs`), so worktrees can run it at the same time.

The branch tracks nothing, so push it the first time with
`git push -u origin fix-footer`. When it's merged, run
`git worktree remove tmp/worktrees/fix-footer` and `git branch -D fix-footer`.

## 3. Postgres

Email your MP, the staff interface and the signatories list on `/campaigns`
read and write a Postgres database. So do some unit tests. The march
sign-up keeps each registration in the database too, but still registers
people when there's none. Every other page works without one.

### Start it

**With Docker (the default):**

```bash
docker compose up -d
```

That starts two Postgres 18 servers, from `docker-compose.yml`:

| Service   | Port | For                                | Kept                                          |
| --------- | ---- | ---------------------------------- | --------------------------------------------- |
| `db`      | 5432 | the dev server's database          | in a Docker volume, between restarts          |
| `db-test` | 5433 | the throwaway databases tests make | in memory only, with durability off for speed |

You still need `psql` on your machine:

- on a Mac, `brew install libpq && brew link --force libpq`;
- on Debian or Ubuntu, `sudo apt install postgresql-client`.

`docker compose down` stops the servers. `docker compose down -v` also
deletes the dev data.

**Natively, instead:**

- **Mac:** install [Postgres.app](https://postgresapp.com). Open it, click
  **Initialize**, then put its tools on your path and open a new terminal:
  ```bash
  sudo mkdir -p /etc/paths.d && echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
  ```
- **Debian or Ubuntu:** `sudo apt install postgresql`, then
  `sudo -u postgres createuser --superuser "$(whoami)"`.

### Tell the site and the tests where it is

Your local settings live in `.env.local`, which git ignores. Start from the
example:

```bash
cp .env.example .env.local
```

Two settings in it say where Postgres is:

| Setting             | What it is                               | Docker (the example's)                                      | Postgres.app                         | apt                                                  |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `NETLIFY_DB_URL`    | the dev server's database                | `postgresql://postgres:postgres@localhost:5432/pauseai_dev` | `postgresql://localhost/pauseai_dev` | `postgresql:///pauseai_dev?host=/var/run/postgresql` |
| `TEST_DATABASE_URL` | the server tests make their databases on | `postgresql://postgres:postgres@localhost:5433/postgres`    | delete it                            | delete it                                            |

Tests read only the `TEST_DATABASE_URL` line of `.env.local`, so its other
settings never reach them. Without that line, tests use the usual `PG*`
variables, or find a local server's socket by themselves, in
`/var/run/postgresql` (Linux) or `/tmp` (Mac). The Postgres user must be
able to create databases, as every test file makes its own.

### Make a database for the dev server

First, in `.env.local`:

- set `TEST_MP_EMAIL` to your email;
- keep the example's `DATA_FIXTURES=1`, for fake supporters to look at;
- set `GMAIL_TOKEN_KEY` to the output of `openssl rand -base64 32`. With
  it, `db:reset` connects the fake letters inbox. Without it, a letter you
  send waits unsent.

Then:

```bash
npm run db:reset
```

This:

- drops the database `NETLIFY_DB_URL` names, if it exists, and creates it
  empty;
- applies every migration in `netlify/database/migrations/`, in order, as
  Netlify does;
- adds the test MPs (`lib/test-mps.json`), whose letters go to
  `TEST_MP_EMAIL`:
  - Testy McTestface MP, found by postcode ZZ99ZZ;
  - Signy McTestface MP (ZZ99ZS), who has already signed the letter to the
    PM;
  - Nomail McTestface MP (ZZ99ZN), who has no email, to see what the form
    says then;
  - Backy McTestface MP (ZZ99ZB), who signed ControlAI's letter backing the
    Sobel bill, so the bill's letter thanks them;
  - Bouncy McTestface MP (ZZ99ZH), who always has
    `no-such-mailbox@pauseai.uk`. That address doesn't exist, so letters to
    them bounce.
- with `DATA_FIXTURES=1`, adds fake data (`tests/fixtures/staff-data.sql`)
  to every table, so every staff page has something on it and the home
  page's dashboard has a number in each tile. The file's own comments say
  what each part is for, and its dates are relative to when it runs. It
  holds:
  - the fixture services' people, events and politicians, under their own
    IDs, so an import writes the same rows rather than doubling them;
  - made-up supporters, letters in every state with their replies and
    bounces, statuses, and every job's runs;
  - staff accounts beside the migration's admin: jo@pauseai.uk (the
    supporters permission, and a kept session), and
    samuel.whitlock@pauseai.uk and policy@pauseai.uk (no permissions).

  With `DATA_FIXTURES=1` and no `TEST_MP_EMAIL`, the test MPs still go in,
  with `test-mp@parliament.example`, since the letters go to the fixture
  outbox anyway. The storyboard's flows start without the fake data, from a
  database with only the test MPs.

Run `db:reset` again whenever you want a clean database. It wipes
everything. It refuses a URL that isn't on your own machine, so it can't
touch the live database.

### Keeping it up to date

After pulling a branch with a new migration, apply what your database
hasn't had, keeping its data:

```bash
npm run db:migrate
```

It applies each pending file in `netlify/database/migrations/` in order,
each in its own transaction, and records it in the database's
`schema_migrations` table, which `db:reset` fills too. That table is only
for local databases: Netlify keeps its own record of what it has applied
on deploy. Like `db:reset`, `db:migrate` refuses a database on another
machine.

The dev server checks the table when it first connects, and says in its
terminal when the database is behind. Only `next dev` checks: production
and previews run on databases Netlify has migrated.

A database made before `db:migrate` existed has no `schema_migrations`
table, so the first time, say which migration it's up to:

```bash
npm run db:migrate -- --applied-up-to 0011
```

That records 0001 to 0011 as applied, then applies the rest.

### Adding a migration

1. Add a file to `netlify/database/migrations/`, numbered after the last:
   `0003_what_it_does.sql`. It must be backward compatible (expand, then
   contract), and work with or without a transaction around it
   (`docs/code-structure.md`).
2. `npm run db:schema` rewrites `netlify/database/schema.sql`, the whole
   schema as the migrations leave it. It needs `pg_dump` 18.
3. `npm run db:migrate` applies it to your dev database.
4. Commit the migration and `schema.sql` together. The PR then shows both
   the migration and what it does to the schema. A unit test fails while
   `schema.sql` is out of date.

Once pushed, a migration can't change. Netlify applies it to the PR's
preview database, and then refuses it if it has changed. CI's "Types,
migrations" job fails if a migration on main or in the branch's last push
has changed, and the pre-push hook (`npm run hooks:install`) stops such a
push (`scripts/migrations-unchanged.mjs`). To change a pushed migration,
add a new one.

Netlify applies migrations in the order of their numbers. It refuses one
numbered at or below the highest it has applied ("added out of order"),
which fails the deploy. So:

- a branch's migration must be numbered after main's last when it merges,
  not just when it began;
- two open PRs mustn't take the same number. Whichever merges second would
  need renumbering, and a pushed migration can't be renumbered.

`scripts/migration-order.mjs` checks this:

- CI's "Types, migrations" job fails if a new migration doesn't come after
  main's. Its checkout of a PR is the branch merged into main.
- The gate and the pre-push hook check the same against `origin/main` as
  last fetched, and warn of an open PR with the same number (from `gh`).
- `npm run worktree` says the next free number.

Gaps in the numbers are fine.

### Collation

A database's collation is how Postgres sorts and compares its text. It's
fixed when the database is made.

Production's collation (Netlify's `netlifydb`) is the builtin `C.UTF-8`,
which sorts by code point. Every capital comes before every lowercase
letter, and accented letters come after z: `apple` sorts after `Zack`, and
`Émile` last. The Postgres Docker image's default is `en_US.utf8`, which is
dictionary order, and a server you install may have another.

So every database the repo makes has production's collation, whatever its
server's default:

- `scripts/fresh-database.mjs` creates each one with it
  (`PRODUCTION_LOCALE`), the dev database from `npm run db:reset` included;
- CI's Postgres is started with it too (`POSTGRES_INITDB_ARGS` in
  `.github/workflows/ci.yml`).

A test that sorts text therefore gets what production gets. No query names
a collation, so on the live site a list sorted by name is in code-point
order, not dictionary order.

To see a database's collation:

```sql
select datlocprovider, datcollate, datlocale from pg_database where datname = current_database();
```

Production's gives `b`, `C.UTF-8`, `C.UTF-8`.

### Looking inside

```bash
psql postgresql://postgres:postgres@localhost:5432/pauseai_dev   # your NETLIFY_DB_URL
```

```sql
select n.name, p.constituency, n.email from politicians p join notable_people n using (id) where p.is_test;
select l.id, l.status, f.email, l.created_at from letters l join letters_from_supporters s using (id) join form_entries f on f.id = s.entry_id order by l.id desc;
select * from letter_events order by id desc limit 20;
```

## 4. Run the site

There are two ways to run it: with fake outside services, or with real ones.

### With fake outside services (start here)

```bash
npm run dev
```

The example `.env.local` sets `DATA_FIXTURES=1`. With it, every call to an
outside service gets a canned answer from
`lib/server/fixtures/outside-services.ts`. Nothing leaves your machine, and
you need no keys:

| Service                  | What the fixture does                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Luma                     | A few made-up events and guests, and every event's guest counts (1,234 going)                                                                                                                                                                                                                                                                             |
| postcodes.io             | Places a few postcodes and towns, and knows the constituency of two: SW1A 1AA (Cities of London and Westminster) and M1 1AE (Manchester Central). Any other postcode is "not found". The test postcodes never ask it.                                                                                                                                     |
| Airtable                 | A politician of each body, one retired and one who left; PauseAI's emails to them; the old form's letters                                                                                                                                                                                                                                                 |
| Parliament's Members API | The Airtable fixture's three MPs in office, with an office email each. Polly Placeholder's differs from Airtable's, so the MP check has something to show.                                                                                                                                                                                                |
| Turnstile                | Accepts every token                                                                                                                                                                                                                                                                                                                                       |
| Postmark                 | Accepts every email, without needing a token, and writes each one to a mail file (`.eml`) in `OUTBOX_DIR`, or `tmp/outbox/` in the dev server.                                                                                                                                                                                                            |
| Google (Gmail)           | Connects any account with no consent screen, naming it from its address (policy@ is "Policy"); sends nothing, writing each email to the outbox as Postmark's fake does; reads an empty mailbox, but for the letters inbox (`LETTERS_INBOX`), which keeps what it sends, and mail written to `LETTERS_INBOX_DIR` (`lib/server/fixtures/letters-inbox.ts`). |

#### Send a letter to the test MP

1. Open http://localhost:3000/campaigns.
2. Enter any name, and postcode `ZZ99ZZ`. The page for writing the letter
   opens, to Testy McTestface MP.
3. Fill in an email and an address, then go to the preview, and send it
   from there. Without its keys, Turnstile isn't needed.
4. The letter is sent. It's the newest `.eml` file in `tmp/outbox/`, with
   its PDFs attached. Open it in a mail app or a text editor.

Once you've logged in with the `supporters` permission, `/staff/campaigns`
shows the letter, on its campaign's page.

The other test postcodes show other cases. Outside production, the form
lists the test postcodes under its postcode field.

- ZZ99ZS finds an MP who has already signed, so the letter to the PM moves
  on to the bill. Look it up to see a campaign's page move on to the next.
- ZZ99ZN finds an MP with no email, so there's no letter to write.
- ZZ99ZB, on the bill's page, finds an MP who signed ControlAI's letter
  backing the bill.

#### Write to a real MP

Outside production, letters can only go to the test MP. That's checked
when the letter is sent, so locally you can look real MPs up but not send
to them. That's on purpose.

With fixtures, the fake data from `npm run db:reset` has the fixture
politicians, so postcode `SW1A 1AA` finds Polly Placeholder.

#### Log in to the staff interface

Open http://localhost:3000/staff/login. In a fixture build the login card
has a hatched purple box under it, the dev login. Each of its buttons signs
you in at once, with no email. There's a button for:

- each account. admin@pauseai.uk is the one every database starts with,
  and `db:reset` gives it the supporters permission as well as admin. The
  fake data adds jo@pauseai.uk, samuel.whitlock@pauseai.uk and
  policy@pauseai.uk.
- the letters inbox (`LETTERS_INBOX`).
- nobody@pauseai.uk, which has no account until you log in as it.

The dev login exists only with `DATA_FIXTURES=1`. Its route is a 404
anywhere else.

To go through the real login instead:

1. Type an address at pauseai.uk in the card. Any such address can log in,
   and gets an account with no permissions the first time. An admin gives
   it permissions on `/staff/accounts`.
2. The login email is the newest file in `tmp/outbox/`. Open the
   `/staff/api/callback?token=…` link in it, in the same browser.

You're then at `/staff`, logged in for a day, or for 30 days with "Keep me
signed in" ticked. Of the fixtures, the real login uses only Postmark's.

#### See every component

http://localhost:3000/gallery is the component gallery: every component and
its variants, a page per group, on fixture data. It's there only with
`DATA_FIXTURES=1`. See `docs/testing.md`, "The component gallery".

#### Serving a branch

To click around a branch from another machine (the Mac a container runs
on, say), on fake data:

```bash
npm run serve -- fix-footer   # or a PR's number; with neither, the worktree it's run in
npm run serve -- fix-footer --stop
```

It serves the branch's worktree, and makes one under `tmp/worktrees/` if
the branch has none. It never serves the main checkout, whose dev server is
yours.

It runs `next dev` in the worktree with the fixture settings, so edits show
as they're saved. The database is a fresh one, with the test MPs and the
fake data, where admin@pauseai.uk has every permission.

In front of `next dev` is a proxy on this machine's network address. It's
there because the session cookie is `Secure`, and a browser drops such a
cookie over plain http from anywhere but localhost. The proxy strips
`Secure`, and tells `next dev` each request came to localhost.

Once the site is up, the script opens the link in Playwright's Firefox
(`npx playwright install firefox`), logs in with the dev login, then prints
the link. It keeps running until stopped.

Each checkout has its own ports, so branches can be served side by side.
The script's `next dev` shares `.next` with the checkout, so don't run a
storyboard review in the same checkout meanwhile.

### With real outside services

Delete `DATA_FIXTURES` from `.env.local`, and fill in the keys you need. Each is explained there. Things to know:

- **Politicians.** After `npm run db:reset` without `DATA_FIXTURES`, the
  database has only the test MPs. With `AIRTABLE_TOKEN` set, copy the real
  politicians from Airtable, then check the MPs against Parliament (about
  650 lookups):

  ```bash
  # With CRON_SECRET=dev in .env.local:
  curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/sync-politicians
  curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/check-mps
  ```

  Then any real postcode finds its MP.

- **Turnstile.** With both keys left out, the check is skipped, in any
  build. With just one set, every letter is refused. The exception is the
  dev server with only the site key, where the check is still skipped. To
  see the widget, use Cloudflare's test keys, which always pass: site key
  `1x00000000000000000000AA`, secret
  `1x0000000000000000000000000000000AA`. A production build refuses the
  test secret.
- **Postmark.** Use the test token `POSTMARK_API_TEST`, which accepts emails
  without sending them. A real server token sends real emails, so only use
  one with the test MP and an inbox you own.
- **Staff login.** The link is emailed through Postmark, so with the test
  token it never arrives. Use fixtures to log in, or a real server token and
  your own pauseai.uk address.
- **Airtable.** `AIRTABLE_TOKEN` needs read access to the UK
  Parliamentarians base's "UK Parliamentarians", "Emails" and "Web form
  emails" tables, and to the members' base. Those are for the politician
  sync, the members import and two one-off imports at
  `/staff/scheduled-jobs`: the Emails sync and the web form letters.
- **Global's CiviCRM.** Its chapter contacts API, at
  `https://crm.pauseai.info/`, is specified in
  [PauseAI/pauseai-civicrm#1175](https://github.com/PauseAI/pauseai-civicrm/issues/1175).
  That repo is private, so an agent can't read the spec: ask Francis to
  paste it. The hourly CiviCRM import reads its `get` with the UK chapter's
  key, `CIVICRM_CHAPTER_KEY`, in Netlify; nothing writes to CiviCRM yet.
  Without the key, fixture builds answer from
  `lib/server/fixtures/civicrm-contacts.json`, and the members import skips
  looking up new members.

### The march sign-up and Luma

The march sign-up adds each person who registers to a Luma event as a
guest. It shows how many Luma has approved beside the hero's button and in
the form's corner. It needs `LUMA_API_KEY`, from the calendar that owns the
event (Luma Plus).

The event is `MARCH_EVENT_ID` in `lib/server/march-event.ts`. That's the
event's API ID (`evt-…`). To find one, open the event's manage page on
Luma: the ID is in the address (`luma.com/event/manage/evt-…`). The live
site registers people for the march's event. Other deploys register them
for the test event beside it, but every deploy counts the march's own.
When registering fails, the server log says why.

The count is Luma's, cached for a minute. The page is rendered with it, and
an open page asks `/api/march/signups` again each minute. When Luma can't
say, the page shows no count.

To try it end to end, register with a real address. Luma drops addresses
at throwaway mail services without saying so: it answers that none were
skipped, but never adds them (mail.tm and Guerrilla Mail, tried in
October 2026).

## 5. Things that run on a schedule, or from outside

None of these run under `npm run dev` by themselves. Call them by hand.

**The scheduled jobs.** On Netlify, scheduled functions in `netlify/functions/`
call these routes. Locally, with `CRON_SECRET=dev` in `.env.local`:

```bash
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/sync-politicians   # the politician sync
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/check-mps           # the MPs against Parliament
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/import-controlai    # ControlAI's letter's signatories
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/import-luma         # the Luma import; with fixtures, the fixture calendar
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/import-members      # the members import; with fixtures, the fixture members
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/tidy-logs           # deletes what the import and audit logs no longer keep, and empty drafts
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/send-mailings       # sends what the letters inbox has queued, then starts the mailings due and sends for a few seconds
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/read-gmail          # reads the connected Gmail accounts for replies and bounces, and relays the letters inbox's
```

What each does, and when it runs on Netlify, is in "Deploying" below.

**Postmark's webhooks.** Set `POSTMARK_WEBHOOK_USER=postmark` and
`POSTMARK_WEBHOOK_PASSWORD=secret`, then post payloads in Postmark's
format:

```bash
# A hard bounce. Use a message_id from the email_sends table, and its address.
curl -u postmark:secret -H 'Content-Type: application/json' localhost:3000/api/postmark/bounce \
  -d '{"RecordType":"Bounce","MessageID":"<id>","Email":"<address>","Type":"HardBounce","Description":"Unknown user","Inactive":true,"CanActivate":true}'

# A reply to a letter sent before the letters inbox. Send it to the letter's address: its postmark_mailbox in
# letters_from_supporters, @letters.pauseai.uk.
curl -u postmark:secret -H 'Content-Type: application/json' localhost:3000/api/postmark/inbound \
  -d '{"FromFull":{"Email":"test-mp@parliament.example","Name":"Testy"},"ToFull":[{"Email":"<postmark_mailbox>@letters.pauseai.uk"}],"CcFull":[],"Subject":"Re: hello","TextBody":"Thanks."}'
```

With `POLICY_INBOX` set, the reply is forwarded there too. With fixtures,
both copies land in the outbox.

**The letters inbox.** With fixtures, `npm run db:reset` connects the fake
letters inbox (`LETTERS_INBOX`, with `GMAIL_TOKEN_KEY` set), so letters go
from it and land in the outbox. The dev server's fake Gmail keeps mail to
the inbox in memory (`lib/server/fixtures/letters-inbox.ts`). With
`LETTERS_INBOX_DIR` set to a folder, a file in its `default/` subfolder is
delivered to the inbox the next time the inbox is read. So to answer a
letter as its MP:

1. Write the reply as a mail file in that subfolder. Address it to the
   supporter's proxy, and give it, as its first such header,
   `Authentication-Results: mx.google.com; dmarc=pass header.from=<the From's domain>`.
2. Run `read-gmail` above.

**Luma's webhook.** Set `LUMA_WEBHOOK_SECRET=whsec_dev`, then post a
payload in Luma's format, signed as Luma signs it:

- The `Webhook-Signature` header is `t=<unix seconds>,v1=<hex>`. The hex is
  the HMAC-SHA256 of `<t>.<body>` with the secret. A timestamp over five
  minutes old is refused.
- The `Webhook-Id` header is the delivery's ID, which stops a redelivery
  counting twice.

```bash
BODY='{"type":"calendar.person.unsubscribed","data":{"id":"usr-1","email":"someone@example.com"}}'
T=$(date +%s)
SIG=$(printf '%s.%s' "$T" "$BODY" | openssl dgst -sha256 -hmac whsec_dev | sed 's/.* //')
curl -H 'Content-Type: application/json' -H "Webhook-Id: msg_1" -H "Webhook-Signature: t=$T,v1=$SIG" \
  localhost:3000/api/luma/webhook -d "$BODY"
```

The address gets an open row in `opt_outs`. A `calendar.person.subscribed`
payload for the same address closes the row.

**Centring a person's photo.** The People page crops each photo to a
square. `imageStyle` in `lib/content/people.ts` sets which part shows, as a
`background-position`. A script can find the face and set it for you:

```bash
npm run data:story-image-detect-faces -- --dry-run Jane-Doe-Stories.jpg  # prints the position
npm run data:story-image-detect-faces -- Jane-Doe-Stories.jpg            # writes it to people.ts
```

Name the file in `public/images/people/` that the person's `imageSrc`
names. Always name one: with no file, the script resets every person's
position, including ones set by hand.

The script centres the face, so you may still want to tweak the result by
hand to show more of the head. It runs Google's BlazeFace model with
TensorFlow.js, which are dev dependencies only.

## 6. Tests

The commands, and the rules for new code, are in [testing.md](testing.md).
What they need from your machine:

- **Database tests** need Postgres reachable: `TEST_DATABASE_URL`, or your
  `PG*` variables, or the local socket (section 3). Each test file copies
  its own database from a migrated template, made once for the run, and
  drops it afterwards.
- **The storyboard** builds and starts the site itself on the checkout's
  own port, unless this checkout's build is already running there
  (`docs/testing.md`, "Commands", says how the port is chosen). Your dev
  server, on 3000, is left alone.

  To skip rebuilding each run, start the build's server yourself, as
  `playwright.config.ts` does for its `webServer`, and leave it running:

  ```bash
  node scripts/serve-fixture.mjs
  # ...and in another terminal:
  npm run test:storyboard
  ```

  Stop and start it again after changing code.

  Each of the storyboard's flows gets its own database, copied from a
  template on the test server (`TEST_DATABASE_URL`, or your local
  Postgres). So the build's own database is only for requests that carry no
  flow's cookie.

## 7. When something goes wrong

| Problem                                                   | Fix                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NETLIFY_DB_URL is not set`                               | Copy `.env.example` to `.env.local` (section 3).                                                                                                                                                                                                                                   |
| `psql: command not found`                                 | Install the Postgres client, and make sure it's on your path.                                                                                                                                                                                                                      |
| `connection to server ... failed` or `Connection refused` | Postgres isn't running (`docker compose up -d`), or `NETLIFY_DB_URL`, `TEST_DATABASE_URL` or `PGHOST` points to the wrong place (section 3).                                                                                                                                       |
| `role "..." does not exist`                               | Create a superuser for yourself (`createuser --superuser`), or set `PGUSER`.                                                                                                                                                                                                       |
| `permission denied to create database`                    | Your Postgres user needs `CREATEDB`: `alter user <you> createdb;`.                                                                                                                                                                                                                 |
| `relation "letters" does not exist`                       | The database is older than a migration: `npm run db:migrate` (section 3).                                                                                                                                                                                                          |
| ZZ99ZZ says no MP found                                   | The database has no test MP. Set `TEST_MP_EMAIL` and run `npm run db:reset`, or run the politician sync.                                                                                                                                                                           |
| The test MP shows "No email found for your MP."           | The test MP was added without an email. Set `TEST_MP_EMAIL` and run `npm run db:reset`.                                                                                                                                                                                            |
| Sending says it failed                                    | Without `DATA_FIXTURES`, check `POSTMARK_SERVER_TOKEN`.                                                                                                                                                                                                                            |
| An email didn't arrive                                    | The server log says what happened to each email: sent through Postmark, with its MessageID, or written to which outbox file. The dev server doesn't send without a real token: with none, or Postmark's test token `POSTMARK_API_TEST`, it writes the email to the outbox instead. |
| Letters to a real MP are refused                          | Expected: outside production, letters go only to the test MP.                                                                                                                                                                                                                      |
| `Executable doesn't exist` from Playwright                | `npx playwright install chromium`.                                                                                                                                                                                                                                                 |

## 8. Deploying

Netlify deploys the site, configured in `netlify.toml`. Pushing to `main`
deploys the live site, and pull requests get previews. Netlify applies the
migrations in `netlify/database/migrations/` on deploy.

A Worker in `backup/` backs the database up to Cloudflare every night. It's
deployed on its own (`backup/README.md`).

Set up outside the code:

- **Settings:** every environment variable is in [.env.example](../.env.example), with what it's for. Netlify needs the same ones, except those the file marks as local only, and `NETLIFY_DB_URL`, which it sets itself.
- **Postmark:** a server, with:
  - two sending domains, each with DKIM, Return-Path and DMARC. `notify.pauseai.uk` sends the site's own email, such as forwarded replies and staff emails. `letters.pauseai.uk` is the inbound domain, with its MX pointing at `inbound.postmarkapp.com`. The letters sent before the letters inbox went from it, and replies to them come to it.
  - webhooks that carry basic auth in the URL, e.g. `https://postmark:<password>@pauseai.uk/api/postmark/bounce`. Bounce and Spam complaint go to `/api/postmark/bounce`, and Inbound goes to `/api/postmark/inbound`.
- **Luma's webhook:** in Luma, open the PauseAI UK calendar, then Settings → Developer → Webhooks.
  1. Add a webhook for `https://pauseai.uk/api/luma/webhook`, with the event types Calendar Person Unsubscribed and Calendar Person Subscribed.
  2. Put its secret (`whsec_…`) into Netlify as `LUMA_WEBHOOK_SECRET`.
  3. Check it works. Unsubscribe a staff address from the calendar's emails, and look for its row in `opt_outs`. Then follow the calendar again. The next full pass over the contacts sets the row's `resubscribed_at`, as Luma's webhook doesn't say when someone comes back ([domain concepts](domain-concepts.md#opt-outs)).

  Luma retries a delivery that isn't answered 2xx three more times, after 1, 2 and 4 minutes. It only sends unsubscribes that happen after the webhook exists.

- **Gmail:** the PauseAI UK Google Cloud project, under the organisation of PauseAI's Google Workspace. That Workspace's primary domain is pauseai.info, and pauseai.uk is in it too. A Workspace has only one organisation (https://cloud.google.com/resource-manager/docs/creating-managing-organization). The project needs:
  - the Gmail API turned on;
  - the Internal user type (Google Auth Platform → Audience), so any account in the Workspace can grant access and Google doesn't review the app (https://support.google.com/cloud/answer/15549945);
  - the scopes `gmail.send`, `gmail.readonly` and `userinfo.profile`, which the app asks for when an account connects. The last is for the account's name, used when its address sends as none of its own;
  - a web application OAuth client whose redirect URI is `https://pauseai.uk/staff/api/gmail/callback`.

  The client's ID and secret go into Netlify as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `GMAIL_TOKEN_KEY` is 32 random bytes in base64. Previews have other addresses, so Gmail can be connected only on the live site.

  The replies read from Gmail are kept in Netlify Blobs, in the `letter-replies` store, which needs no setting. The backup Worker copies them with `BACKUP_SECRET`. That secret goes into Netlify, and into the Worker as `SITE_BACKUP_SECRET` (`backup/README.md`).

- **The letters inbox:** a Gmail account of PauseAI UK's Workspace at pauseai.uk, which supporters' letters to MPs go from (`docs/domain-concepts.md`, "Letters through the letters inbox"). It's used for nothing else. To set it up:
  1. Put its address into Netlify as `LETTERS_INBOX`. It goes nowhere in the repo, which is public.
  2. Give it a staff account (`/staff/accounts`).
  3. Log in as it, and connect its Gmail on `/staff/me`. There it also asks for `gmail.modify`, to label and trash its mail.

  Until it's connected, letters are kept and wait in the queue.

- **The notification inbox:** `NOTIFICATION_INBOX` is where the site emails when something needs a person (`docs/domain-concepts.md`, "Email"). On the live site it's `notification@pauseai.uk`. When it's unset, nothing is sent.
- **Staff accounts:** every database starts with one account, `admin@pauseai.uk`, with the admin permission. Anyone else at pauseai.uk gets an account with no permissions on their first login, or an admin adds them on `/staff/accounts`, where permissions are set. What an account opens depends on its permissions:
  - with none, the ordinary pages;
  - with supporters, the supporter pages too;
  - with admin, the accounts page, the audit log and the sent emails too.

  Give admin to at least one other person, as the last admin can't be removed. An erasure request is handled as `docs/data-protection.md` says.

- **A new database:** from `/staff/scheduled-jobs`:
  1. Run the politician sync. Until it has run, Email your MP finds no MPs.
  2. Run the Emails sync and the one-off import of the web form letters.

  The Luma import fills the supporter pages over its first few runs, and links every letter already written. Run it from `/staff/scheduled-jobs` too, to watch it.

### The scheduled jobs

Each is a Netlify scheduled function in `netlify/functions/` that calls its route under `/api/cron/` (`docs/code-structure.md`, "Scheduled jobs"), and each has a page under `/staff/scheduled-jobs` with its runs and a button (`docs/domain-concepts.md`, "Imports"). Times are UTC.

| Job                                          | When                                  | Needs                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-politicians`                           | 06:21 daily                           | `AIRTABLE_TOKEN`                                                                                                                                                                                                                                                                                   |
| `check-mps`, the MPs against Parliament      | 06:23 daily                           | Nothing. About 650 requests to Parliament's Members API, which take some seconds; a scheduled function gets 30, so a check that starts timing out has outgrown it.                                                                                                                                 |
| `import-controlai`, the letter's signatories | 06:25 daily                           | Nothing                                                                                                                                                                                                                                                                                            |
| `tidy-logs`                                  | 06:27 daily                           | Nothing                                                                                                                                                                                                                                                                                            |
| `import-luma`                                | every 5 minutes, from 2 past the hour | `LUMA_API_KEY`. Its background function does the work. The first copy of the calendar takes a few runs; after that each run reads what's changed ("Supporters" in `docs/domain-concepts.md`).                                                                                                      |
| `read-gmail`                                 | every 5 minutes                       | The connected Gmail accounts                                                                                                                                                                                                                                                                       |
| `send-mailings`                              | 18 past every hour                    | The connected Gmail accounts. Its background function sends what one call can't (`send-mailings-background`), which credit-based plans have (https://docs.netlify.com/build/functions/background-functions/). It starts no mailing between midnight and 06:18, so one due overnight goes at 06:18. |
| `import-members`                             | 19 past every hour                    | `AIRTABLE_TOKEN`, with read access to Stichting PauseAI's "Members & Actions" base (`appWPTGqZmUcs3NWu`), which the global team grant. A run reads every UK member we may hold, which counts against the global team's Airtable plan's monthly API calls.                                          |
| `import-civicrm`                             | 49 past every hour                    | `CIVICRM_CHAPTER_KEY`, our UK chapter's key to Global's chapter contacts API. A run reads every UK chapter contact, a page of 500 at a time.                                                                                                                                                       |

The database sleeps after five minutes without a query, and is billed while it's awake: about 10 credits an hour at its smallest. The 5-minute jobs keep it awake all day.
