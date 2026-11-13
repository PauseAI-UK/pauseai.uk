# Database backup

Every night at 03:00 UTC, a Cloudflare Worker backs up the live database to
an R2 bucket on Cloudflare, and checks that the backup is good. It's a copy
outside Netlify. Netlify keeps its own backups too, for 3 to 30 days
depending on the plan. They're under the project's Data & Storage,
Database, Backups
(https://docs.netlify.com/build/data-and-storage/netlify-database/backup-and-recovery/).

It's a package of its own, apart from the site: it runs on Cloudflare, not
Netlify, and has its own dependencies and tests.

## How it works

The cron trigger in `wrangler.jsonc` starts the Worker (`worker/index.ts`).
The Worker starts a container (`Dockerfile`, `container/`) with Postgres
18's tools, and asks it for a backup. The container:

1. dumps the database with `pg_dump`, in its custom format. It leaves out
   two things the read-only user can't read:
   - the `netlify` schema, which is Netlify's record of applied migrations.
     The site's data is all in `public`.
   - the sequences' values. A sequence hands out its table's next ID, and a
     restore sets it from the data instead.
2. reads the dump's table of contents with `pg_restore --list`, which fails
   on a corrupt or truncated file;
3. restores the dump into a scratch Postgres of its own, as "Restore a
   backup" below does. There it counts the rows in every table, and finds
   the newest row in some.

So every backup is proved to restore, and the counts describe what's in
the backup, not the live database.

The Worker stores the dump in R2, which checks its SHA-256. Then it stores
a manifest beside the dump: the dump's size and hash, and the counts. Then
it checks the manifest against the rules in `worker/checks.ts`, and against
the backup before:

- the dump hasn't shrunk by more than 20%
- letters and letter events have no fewer rows than last time. They're
  deleted only when a scheduled mailing is stopped or a supporter is
  erased, so fewer usually means data was lost.
- `import_runs` has a row from the last 36 hours. The nightly MP sync records
  a run every night, even when nothing changed, so this shows the backup
  has last night's data.
- `politicians` has at least 600 rows

Then the container archives the messages the site keeps whole, gzipped,
in Netlify Blobs: the replies to letters, one-off emails, and replies to
broadcasts by email. That's outside the database, so the dump doesn't hold
them. It writes every one into one tar file, each named by its key, which
the Worker stores beside the dump. A key's message never changes, so it
copies each message last night's archive has, which the Worker sends it,
and fetches the rest through the site's read-only route
(`app/api/backup/messages`), with the site's `BACKUP_SECRET`. It also
fetches again a seventh of them each night, by key, so every message is
checked against the site once a week, and a copy spoilt in one archive
isn't carried on for long; if the site fails one of those, last night's
copy is kept. So a night fetches a few hundred messages, not all of them,
as a quick burst of a thousand or so made the site stop answering. It asks
two at a time, with a half-second pause after, and tries a request that
gets no answer, or a 5xx or 429, again after 1, 2, 4, 8, 16, 32, 60 and
120 seconds. A message it still can't get is left out of that night's
archive, which is stored all the same, and the next night tries it again:
the run reports it as a problem, naming it and the reason ("fetch failed:
UND_ERR_CONNECT_TIMEOUT, 9 times"). So a first archive, or one after a bad
night, fills in over a night or two rather than failing whole. If last
night's archive is missing or can't be read, it fetches them all, and the
manifest says why (`previousUnused`). The manifest records the archive:
how many messages, how many fetched, which the site listed but had none
for, and which it couldn't fetch. The checks say so if any are missing or
couldn't be fetched, or the archive has more than 20% fewer messages than
the night before. If the archive can't be made at all, the dump is still
kept, and the problem emailed. Each message is gzipped already, so the tar isn't compressed again.

Any problem, or a backup that fails outright, is emailed through Postmark.
If a Healthchecks.io ping URL is set (`HEALTHCHECK_URL`), every run pings it
once, at the end, with its report as the ping's body: the URL itself for a
run with no problems, which Healthchecks.io marks up; the URL with `/fail`
added for a run with any, which it marks down and emails about
(https://healthchecks.io/docs/http_api/). It emails too when a night's
backup never pings at all. Cloudflare never shows a secret again: a ping
arriving on the check's page is how to know the URL is right.

The bucket holds:

| Key                     | What                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `dumps/<time>.dump`     | the dump, kept for 90 days (an R2 lifecycle rule)             |
| `manifests/<time>.json` | its manifest, kept for good: a history of the counts          |
| `latest.json`           | the newest manifest, which the next run compares itself with  |
| `messages/<time>.tar`   | the site's kept messages, kept for 30 days (a lifecycle rule) |

## Set it up

It needs:

- a **Cloudflare account** on the Workers Paid plan, which containers need
  (https://developers.cloudflare.com/containers/pricing/)
- **Docker** running, as deploying builds the container's image
- the live database's **read-only connection string**: in Netlify, the
  project's Data & Storage > Database
  (https://docs.netlify.com/build/data-and-storage/netlify-database/access-control/)
- a **Postmark server token** that can send from `ALERT_FROM` in
  `wrangler.jsonc`, and the address to send problems to
- the site's **`BACKUP_SECRET`**, from its Netlify settings, for archiving
  the messages it keeps
- optionally, a **Healthchecks.io** check (https://healthchecks.io/docs/):
  a period of 1 day, and a few hours' grace

Then:

```bash
cd backup
npm ci
./setup.sh
```

`setup.sh` logs in to Cloudflare, creates the bucket and its lifecycle rule,
asks for the secrets and deploys.

The first time, it makes the Worker's `RUN_SECRET` and prints a `curl`
command with it, which runs a backup at once and shows the report. Try the
command a few minutes after the first deploy, once the container is ready,
and keep the secret somewhere safe.

Run `setup.sh` again to change a secret or add a lifecycle rule it didn't
make before; Enter keeps each secret as it is.

## Deploy a change

From an up-to-date `main`:

```bash
git pull
cd backup
npm ci
npm run deploy
```

It prints the Worker's address,
`https://pauseai-uk-backup.<subdomain>.workers.dev`, the subdomain being the
Cloudflare account's own (also under Workers & Pages, "Subdomain"). Cloudflare
rolls a new container image out over a few minutes: under Containers >
pauseai-uk-backup-backupcontainer > Versions, wait till the new version has
100% before running a backup by hand, or the old one may answer. "Image
already exists remotely" and "no changes" mean the container is as it was;
only the Worker changed.

## Run a backup now

```bash
curl -X POST https://pauseai-uk-backup.<subdomain>.workers.dev/run -H "Authorization: Bearer <RUN_SECRET>"
```

It answers when the backup is done, with "No problems." or a list of them,
as the email would say. That takes a while: about three minutes for the
dump, then a few minutes for the messages, or longer the first time, when
it fetches them all. Follow it in the logs ("Follow a run", below) rather
than waiting on curl.

`RUN_SECRET` is what `setup.sh` printed the first time. Cloudflare won't show a secret again, so
if it's lost, make another; only this command uses it:

```bash
openssl rand -hex 32                 # keep it somewhere safe
npx wrangler secret put RUN_SECRET   # paste it when asked
```

## Follow a run

Every way to see how a backup is doing, or did:

- **The container's logs**: in Cloudflare's dashboard
  (https://dash.cloudflare.com/?to=/:account/workers/containers), Containers >
  pauseai-uk-backup-backupcontainer > Logs. Each step shows as a request:
  `POST /backup` (the dump and its checks), `GET /dump`, `POST /messages`
  (fetching the messages), `GET /messages`. While it writes them, "Messages: 300 of 1774,
  12 fetched from the site", every hundred. "Activity expired, signalling container
  to stop" is it going to sleep two minutes after its last request.
- **The Worker's logs**: Workers & Pages > pauseai-uk-backup > Logs
  (https://dash.cloudflare.com/?to=/:account/workers-and-pages), or live in a
  terminal with `npx wrangler tail pauseai-uk-backup`
  (https://developers.cloudflare.com/workers/observability/logs/real-time-logs/).
- **The report**: the answer to `/run` (above), and the email any problem
  sends, from `ALERT_FROM` to `ALERT_TO`, through Postmark.
- **Healthchecks.io**, if it's set up (https://healthchecks.io/projects/):
  each run's ping, and an email when a night's backup never runs.
- **What it stored**: the bucket in R2
  (https://dash.cloudflare.com/?to=/:account/r2/overview), or the newest
  manifest, with the dump's key and counts, and the archive's under
  `messages`:

```bash
npx wrangler r2 object get pauseai-uk-backups/latest.json --remote --pipe
```

## Read the messages' archive

```bash
npx wrangler r2 object get pauseai-uk-backups/messages/2026-10-19T03-00-00Z.tar --remote --file messages.tar
tar -tf messages.tar | wc -l   # as many as the manifest's messages.messages
mkdir messages && tar -xf messages.tar -C messages
gunzip -c messages/<account>/<id>.eml.gz   # one message, as it came
```

## Restore a backup

1. Find a dump's key. `latest.json` has the newest dump's.
2. Download that dump.
3. Restore it into an empty database with `pg_restore`.
4. Run `container/restore-sequences.sql`. It sets each table's sequence to
   follow the table's highest ID, as the dump doesn't hold the sequences'
   values. If you skip it, the next new row clashes with an old one.
5. To restore the messages, download the archive the manifest names
   (`messages.key`) and put each file back in Netlify Blobs, in the
   site's `letter-replies` store, under its name in the archive. An
   archive is kept for 30 days, so an older dump has none.

```bash
cd backup
npx wrangler r2 object get pauseai-uk-backups/latest.json --remote --pipe   # the newest dump's key, and its counts
npx wrangler r2 object get pauseai-uk-backups/dumps/2026-10-19T03-00-00Z.dump --remote --file backup.dump
createdb restored
pg_restore --no-owner --no-privileges --dbname=restored backup.dump
psql --dbname=restored --file=container/restore-sequences.sql
npx wrangler r2 object get pauseai-uk-backups/messages/2026-10-19T03-00-00Z.tar --remote --file messages.tar
mkdir messages && tar -xf messages.tar -C messages   # each message, gzipped, under its key
```

## Tests

```bash
cd backup
npm test            # with the 100% coverage gate, as the site's
npm run typecheck
```

The container's tests dump and restore real databases. They make them on
the Postgres the `PG*` variables or the local socket point to, and don't
read the site's `TEST_DATABASE_URL`. Each dump is restored into a scratch
server, so they need Postgres 18's server programs (`initdb`, `pg_ctl`) on
your path as well as its client tools.

CI runs both commands (`.github/workflows/ci.yml`).
