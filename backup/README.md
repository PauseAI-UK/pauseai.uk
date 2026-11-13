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
them. It fetches every one through the site's read-only route
(`app/api/backup/messages`), with the site's `BACKUP_SECRET`, into one tar
file, each named by its key, which the Worker stores beside the dump. The
archive holds what the site has that night, so a message erased on the site
is in no archive after, and the old archives expire. The manifest records
the archive, and the checks say so if a message the site listed was missing
from its store, or the archive has more than 20% fewer messages than the
night before. If the archive fails, the dump is still kept, and the problem
emailed.

Any problem, or a backup that fails outright, is emailed through Postmark.
If a Healthchecks.io ping URL is set, every run pings it. Healthchecks.io
then emails when a night's backup never runs at all.

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

Run `setup.sh` again to change a secret, and `npm run deploy` to deploy
changes to the code.

The Worker's logs are in Cloudflare's dashboard: Workers & Pages >
pauseai-uk-backup > Logs.

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
tar -xf messages.tar -C messages   # each message, gzipped, under its key
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
