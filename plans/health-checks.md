# Health checks

UptimeRobot watches only the home page, which is static and stays up
when the database or the scheduled jobs are down. That monitor stays.
This plan adds five more, covering ten checks, so that Discord hears
when the site stops doing its work.

## How it works

- The site gets a public address for each group of checks, such as
  `/api/health/product/replies`. It answers 200 when every check in the
  group is good and 503 when any is bad.
- UptimeRobot gets one monitor for each group. It asks every five
  minutes and posts in Discord, as its monitors do now. Its post gives
  the monitor's name, the address and "HTTP 503", so the address says in
  words what the group is.
- The checks are grouped so that the whole site going down makes five
  posts, not ten. The page at a group's address says which of its checks
  is bad.
- A check only reads the database. It never calls Postmark, Google or
  any other service.
- When the database is down, every check is bad, so all five monitors go
  red. A check never answers good without having looked.
- The staff pages and the emails staff get stay as they are.

## The five monitors

A technical monitor going red means something is broken. A product
monitor going red means something has stopped happening, which may be a
fault or may be a quiet week, so it means "have a look".

| Monitor's name               | Address, after `https://pauseai.uk`       |
| ---------------------------- | ----------------------------------------- |
| Technical: database and jobs | `/api/health/technical/database-and-jobs` |
| Technical: sending           | `/api/health/technical/sending`           |
| Product: sign-ups            | `/api/health/product/sign-ups`            |
| Product: letters written     | `/api/health/product/letters-written`     |
| Product: replies             | `/api/health/product/replies`             |

## The ten checks

| Monitor                      | Check                          | Bad when                                                     |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Technical: database and jobs | Database                       | The database doesn't answer                                  |
|                              | Jobs                           | A job is late, or has gone wrong three times in a row        |
| Technical: sending           | Email sending                  | The three newest emails all failed to send                   |
|                              | WhatsApp sending               | Fewer than half of the texts sent lately were delivered      |
| Product: sign-ups            | New CiviCRM people             | No new person from CiviCRM for 1 day                         |
|                              | New Luma sign-ups              | No new sign-up to an event for 1 day                         |
| Product: letters written     | Letters written                | No supporter has written to a politician for 4 days          |
| Product: replies             | Replies to supporters' letters | No politician has replied to a supporter's letter for 3 days |
|                              | Replies to mailings            | A mailing sent 3 to 14 days ago has no replies               |
|                              | Replies to broadcasts          | A broadcast sent 2 to 14 days ago has had nothing come back  |

Each number is a named constant beside its check, so it's easy to
change. The CiviCRM limit rests on two weeks of history, so it's looked
at again after a month.

## The jobs check

The same rule covers every scheduled job. A job is bad when either is
true:

- **It's late.** Its next run was due and hasn't happened, after a
  grace period: 15 minutes for a job that runs every 5, 45 minutes for
  the mailing job, 2 hours for CiviCRM, 3 hours for a nightly job.
- **It has gone wrong at three scheduled times in a row.** A run has
  gone wrong when it failed or recorded a problem. That takes 15 minutes
  for Gmail and Luma, 45 minutes for the mailing job, 3 hours for
  CiviCRM and 3 nights for a nightly import. A run retried twice within
  seconds counts once.

One change to the Gmail job makes that rule catch a disconnected inbox.
Today, when Google refuses an account, the site stops reading it and
later runs look clean. The job will always try the letters inbox
(`LETTERS_INBOX`) and the policy inbox (`POLICY_INBOX`), and record a
problem on each run that can't read one. Staff still get one email
about it, not one a run. A staff member's own account is left alone.

## The two sending checks

- **Email.** Bad when the three newest emails the site tried to send,
  through Postmark or Gmail, were all refused or failed. Every email
  sent in the last month was accepted, so three in a row is a real
  fault.
- **WhatsApp.** A few texts in every broadcast fail for ordinary
  reasons, such as a number that's no longer on WhatsApp, so three in a
  row means nothing here. This looks at the texts handed to WhatsApp
  between 2 hours and 3 days ago. With 50 or more of them, it's bad when
  fewer than half are marked delivered. Broadcasts so far have had over
  nine in ten delivered. It goes red if WhatsApp is refusing our texts,
  and also if WhatsApp has stopped telling the site what was delivered.

## The two "sent, but nothing back" checks

Replies to a mailing or a broadcast only come after one goes out, so
these ask whether the last one was answered.

- **Mailings.** Bad when a mailing went to 20 or more politicians, its
  first letter was sent 3 to 14 days ago, and no politician has replied
  to any of its letters. An out-of-office doesn't count.
- **Broadcasts.** Bad when a broadcast went to 200 or more people on
  WhatsApp, or 2,000 or more by email, its first copy was sent 2 to 14
  days ago, and nothing has come back. Anything counts here: a reply, an
  out-of-office or a reaction.

Both are good when nothing was sent lately. A mailing or broadcast stops
counting after 14 days, so an old one can't hold the monitor red.

When the broadcasts monitor goes red, someone on staff replies to the
broadcast from their own phone or inbox. If the monitor goes green, the
route works. If it doesn't, the fault is real.

## What an address answers

The body lists each check in the group and what it found, so someone who
follows the link from Discord can see what's wrong without logging in:

```json
{
  "group": "product/replies",
  "status": "bad",
  "checkedAt": "2026-11-26T10:40:00Z",
  "checks": {
    "letter-replies": { "status": "bad", "hoursSinceLast": 80, "limitHours": 72 },
    "mailing-replies": { "status": "ok", "unanswered": [] },
    "broadcast-replies": { "status": "ok", "unanswered": [] }
  }
}
```

```json
{
  "group": "technical/database-and-jobs",
  "status": "bad",
  "checkedAt": "2026-11-26T10:40:00Z",
  "checks": {
    "database": { "status": "ok" },
    "jobs": {
      "status": "bad",
      "late": [{ "job": "read-gmail", "lastRan": "2026-11-26T09:55:13Z", "minutesOverdue": 40 }],
      "goingWrong": [{ "job": "import-ni-assembly", "runs": 3 }]
    }
  }
}
```

Anyone can load it, so it holds job names, times and limits, and never
an error's words, a name or an email address. `/api/health` alone runs
all ten checks and lists each group's answer.

## Building it

- The routes are in `app/api/health/`, with each check a small function
  of its own. They aren't cached, and they answer HEAD as well as GET.
- Each check has a time limit, so a database that hangs answers `bad`.
- There's no migration and no personal data in the answer.
- Each check is tested both ways, and each limit at its edge.
- `docs/development.md` lists the monitors and what to do when one goes
  red. `docs/testing.md` gets the route's line.
- `investments/scheduled-job-alerts.md` is deleted, or rewritten to say
  what's left.
- The monitors point only at production, since jobs don't run on a
  deploy preview. Someone with UptimeRobot's login adds them by hand
  once the route is live, each with the name and address in the table.
