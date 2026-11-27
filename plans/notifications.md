# Notifications

Today some things email the notification inbox, some show a strip on the
dashboard, some do both, and nothing counts in the sidebar. Who's Cc'd
about a broadcast depends on the email: its creator, whoever submitted its
template, or whoever last scheduled it, looked up in the audit log.

This plan makes them one thing, a notification, kept in the database,
shown the same way everywhere, and sent by email, browser or Discord to
whoever wants it.

## How it works

- **A feature opens a notification.** The notification system shows it
  and sends it; no feature writes its own email or strip.
- **Everyone who can open its page sees it.** The page's permission is the
  audience: Broadcasts and Blocked addresses need supporters, Errors needs
  admin, the rest are all staff.
- **People watch things**: broadcasts and mailings, Gmail accounts, and
  campaigns later. You start watching when you create, submit a template
  for, schedule, send or answer a reply to one, and can press Watch or Stop
  watching.
- **Yours** is a notification about something you watch, or in a category
  you deal with.
- **Two sorts.** A _to do_ needs someone to act, and ends when that's done
  with its page's own buttons. _News_ says something happened; it has a
  Dismiss button. Either ends when it's no longer true, for everyone.
- **One message per notification**, sent once: what, detail, link. A job's
  run sends one at its end for everything it opened.
- **Each person picks what reaches them** by email and in the browser, per
  category: nothing, theirs, or everything. Admins set a Discord channel per
  category. The notification inbox gets everything, and a few _must reach_
  kinds always email it.
- **The backup Worker stays outside this**, emailing its own `ALERT_TO`, as
  it must work when the site is what's broken.

## What people see

Mocked up on the real staff pages:
https://claude.ai/artifact/J5XjAQieorWGSetsYjmtNA

- **Sidebar counts**, beside the page each notification shows on, of
  things waiting (2 replies count 2). Yours in orange, others' as a grey
  "+2", or grey alone. On a phone, the bar shows how many are yours.
- **Every counted thing wears the count's pill**, orange or grey, so the
  number can be matched to the page: on a strip as its tag ("2 yours",
  "Watched by Sam", "Sam deals with press", "Anyone"), on a row as
  "Waiting".
- **Strips** sit at the top of the page, yours first. News is green, a to
  do amber, or red when something's broken. Each says how it clears.
- **No strip where the page already lists the things**: Errors, Press,
  Addresses to fix, or a broadcast's own replies. The rows wear the pill.
  Strips are for pointing from elsewhere, and for what has no list.
- **The dashboard has no strips.**
- **Watching** shows on a broadcast's or mailing's page, with why: "Jane
  Smith (created it), Sam Jones (scheduled it)". Starting to watch is
  always said: "Scheduled. You're now watching this broadcast. Stop
  watching".
- **Your account** asks "What you deal with", a tick per category, then
  "What reaches you outside the site": Nothing, Yours or Everything by
  email and in this browser, and the category's Discord channel.

## Every notification

"About" is the watched things it's about: their watchers are who it's
yours for. "Ends when" is what makes it no longer true; _new_ marks what
doesn't exist yet. "Today" is how staff hear now. Red and must-reach are
marked in Sort. A first guess, to check against each feature's code.

| Notification                                              | Sort                   | Page              | About                                                 | Ends when                                                          | Today                          |
| --------------------------------------------------------- | ---------------------- | ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| **Broadcasts**                                            |                        |                   |                                                       |                                                                    |                                |
| A template submitted for review                           | news                   | Broadcasts        | its broadcast                                         | WhatsApp decides                                                   | email, Cc submitter            |
| A template approved                                       | news                   | Broadcasts        | its broadcast                                         | its drafts are all scheduled or deleted                            | email, Cc submitter            |
| A template rejected                                       | news                   | Broadcasts        | its broadcast                                         | it's sent again, or deleted                                        | email, Cc submitter            |
| A template's quality dropped                              | news                   | Broadcasts        | its broadcast                                         | it recovers, or is paused, _new_                                   | among WhatsApp's alerts        |
| A WhatsApp template stopped or paused                     | news                   | Broadcasts        | its broadcast                                         | WhatsApp allows it again, or it's deleted                          | email                          |
| Text replies waiting for an answer                        | to do                  | Broadcasts        | the broadcast                                         | Reply or Nothing to do on each                                     | email, Cc creator; strip       |
| A broadcast waits or is held back                         | news                   | Broadcasts        | the broadcast                                         | it sends, gives up, or is stopped                                  | email, Cc scheduler            |
| A broadcast gives up                                      | news                   | Broadcasts        | the broadcast                                         |                                                                    | email, Cc scheduler            |
| A WhatsApp message that answers no broadcast              | news                   | Broadcasts        |                                                       |                                                                    | email                          |
| WhatsApp: our number's quality or limit, or our account   | news, must reach       | Broadcasts        |                                                       |                                                                    | email                          |
| **Letters and MPs**                                       |                        |                   |                                                       |                                                                    |                                |
| An MP's address bounces or is blocked                     | to do, red             | Addresses to fix  | each mailing with letters held; campaigns, in phase 8 | changing the address, or Unblock                                   | email; strip; mailing report   |
| Replies waiting on a mailing                              | to do                  | Mailings          | the mailing                                           | Reply or Nothing to do on each                                     | strip                          |
| Mail in a shared mailbox matching no politician or thread | news                   | Correspondence    |                                                       |                                                                    | report                         |
| Letters-inbox mail a read couldn't handle                 | news                   | Correspondence    |                                                       |                                                                    | email; strip                   |
| Supporters' copies bounced, and replies held              | news                   | Blocked addresses | campaigns, in phase 8                                 |                                                                    | daily report                   |
| A politicians import held for a decision                  | to do                  | Scheduled jobs    |                                                       | apply or discard                                                   | email; strip                   |
| **Press**                                                 |                        |                   |                                                       |                                                                    |                                |
| Finds from a press survey waiting to be judged            | to do                  | Press             |                                                       | Add to /press or Not ours on each                                  | report, one a survey           |
| **Events**                                                |                        |                   |                                                       |                                                                    |                                |
| An event that couldn't be tagged                          | to do                  | Events            |                                                       | tagged on Luma, or the event passes, _new_                         | email                          |
| **Technical**                                             |                        |                   |                                                       |                                                                    |                                |
| An error seen on the site                                 | to do, red, must reach | Errors            |                                                       | Done                                                               | email                          |
| A job's run failed                                        | to do, red, must reach | Scheduled jobs    |                                                       | a later run works, or Run it now                                   | email; strip                   |
| A job's run reported new problems                         | to do                  | Scheduled jobs    |                                                       | a later run reports none of them                                   | email                          |
| A Gmail account Google disconnected                       | to do, red             | Your account      | the Gmail account                                     | it's connected again                                               | email, not to its owner        |
| The letters or policy inbox disconnected                  | to do, red, must reach | Scheduled jobs    |                                                       | someone logs in as it and connects it                              | health check only              |

Notes:

- **An MP's address** is one notification however many letters it holds,
  with the bounce's reason from `email_problems`. It replaces the mailing's
  daily bounce report.
- **Mail needing a look in Gmail** (the two Correspondence rows): a strip
  with an Open in Gmail link per message, by its Gmail ID. The email names
  each sender and subject, read from Gmail as it's sent.
- **A stray WhatsApp message** isn't kept on the site. Its email carries the
  number and words, passed to that send and never stored; whoever reads it
  messages them on WhatsApp if it matters.
- **The letters or policy inbox disconnected** tells whoever deals with
  Technical what the health check is alerting about.
- **Letters waiting too long** stops being a notification: it becomes the
  "letters-queue" health check (the oldest sendable letter is under 3 hours
  old), replacing `tellOfLateLetters()`.

## The tables

### `watchers`: one person watching one thing

```sql
CREATE TABLE watchers (
  thing text NOT NULL CHECK (thing IN ('broadcast', 'mailing', 'gmail')),
  thing_id text NOT NULL,
  email text NOT NULL REFERENCES staff_accounts (email) ON DELETE CASCADE,
  why text NOT NULL CHECK (why IN ('created', 'submitted', 'scheduled', 'sent', 'answered', 'pressed watch')),
  since timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thing, thing_id, email)
);
```

| thing     | thing_id | email                 | why       | since        |
| --------- | -------- | --------------------- | --------- | ------------ |
| broadcast | `212`    | jane.smith@pauseai.uk | created   | 20 Nov 10:02 |
| broadcast | `212`    | sam.jones@pauseai.uk  | scheduled | 24 Nov 08:55 |

Stop watching deletes the row; acting again starts watching again.

### `notifications`: one notification

Opening the same kind about the same thing while one is open updates it.

```sql
CREATE TABLE notifications (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,                -- declared in code
  about text NOT NULL,               -- as the kind keys it: a mailing's ID, a job's name
  facts jsonb NOT NULL DEFAULT '{}', -- IDs, counts and codes, never a name or address
  run_id bigint,                     -- the run that opened it, to send a run's together
  opened_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_how text CHECK (ended_how IN ('done', 'dismissed')),
  ended_by text,                     -- who dismissed it
  CHECK ((ended_at IS NULL) = (ended_how IS NULL))
);
CREATE UNIQUE INDEX ON notifications (kind, about) WHERE ended_at IS NULL;
```

| id  | kind                | about  | facts                           | opened_at    | ended_how | ended_by              |
| --- | ------------------- | ------ | ------------------------------- | ------------ | --------- | --------------------- |
| 41  | `texts-waiting`     | `212`  | `{"replies": 2}`                | 26 Nov 09:10 |           |                       |
| 42  | `template-approved` | `88`   | `{"drafts": 2}`                 | 26 Nov 09:12 | dismissed | jane.smith@pauseai.uk |
| 43  | `mp-address-bounce` | `4410` | `{"letters": 3, "problem": 77}` | 24 Nov 14:02 | done      |                       |

### `notification_things`: one watched thing a notification is about

```sql
CREATE TABLE notification_things (
  notification_id bigint NOT NULL REFERENCES notifications ON DELETE CASCADE,
  thing text NOT NULL,
  thing_id text NOT NULL,
  PRIMARY KEY (notification_id, thing, thing_id)
);
```

| notification_id | thing     | thing_id |
| --------------- | --------- | -------- |
| 41              | broadcast | `212`    |
| 43              | mailing   | `31`     |
| 43              | mailing   | `34`     |

### `notification_sends`: one notification sent to one place

So nothing goes twice, and a failed send is tried again.

```sql
CREATE TABLE notification_sends (
  notification_id bigint NOT NULL REFERENCES notifications ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'browser', 'discord')),
  recipient text NOT NULL,   -- a staff email, the notification inbox, or a category
  sent_at timestamptz,
  PRIMARY KEY (notification_id, channel, recipient)
);
```

| notification_id | channel | recipient                | sent_at      |
| --------------- | ------- | ------------------------ | ------------ |
| 41              | email   | jane.smith@pauseai.uk    | 26 Nov 09:10 |
| 41              | email   | notifications@pauseai.uk | 26 Nov 09:10 |

### `notification_settings`: one person's choices for one category

No row means yours by email, nothing in the browser, not dealing with it.

```sql
CREATE TABLE notification_settings (
  email text NOT NULL REFERENCES staff_accounts (email) ON DELETE CASCADE,
  category text NOT NULL,
  deals_with boolean NOT NULL,
  by_email text NOT NULL CHECK (by_email IN ('nothing', 'yours', 'everything')),
  by_browser text NOT NULL CHECK (by_browser IN ('nothing', 'yours', 'everything')),
  PRIMARY KEY (email, category)
);
```

| email                 | category | deals_with | by_email   | by_browser |
| --------------------- | -------- | ---------- | ---------- | ---------- |
| jane.smith@pauseai.uk | letters  | true       | everything | yours      |

`browser_subscriptions` (each browser someone allowed: its push endpoint
and keys) comes with phase 7.

Not stored: the words (made from `facts` in the feature's copy), each
kind's sort, page and category (in code), whether it's yours (from
watchers and settings), the counts, and the Discord webhooks (environment
variables).

## In code

- `watch(thing, id, email, why)` beside each action's `logChange()`, saying
  whether it added someone; `<Watching>` on the page.
- `defineNotifications()` in each feature's copy, as `defineProblems()`:
  category, sort, tone, page, link, must reach, and `stillOpen()` for the
  sweep.
- `notify(kind, about, facts, { things, run })` opens or updates one;
  `ended(kind, about)` from the code that finishes it; a sweep in an
  existing scheduled function ends what `stillOpen()` says isn't.
- `sendNotifications()` sends what's waiting, from watchers and settings,
  replacing `notifyStaff()`.

## Personal data

Only staff emails are kept; `facts` holds IDs and counts, and a check in
`tests/checks/` holds that no kind stores a name or address.
`docs/data-protection.md` gets watchers, settings, browser subscriptions,
and push services and Discord as processors of staff work. Deleting a staff
account removes their watching, settings and subscriptions.

## Phases

Each is a PR or a few, with its flows in the storyboard, leaving the site
working. New words are placeholders, as AGENTS.md says, until someone writes them.

1. **Watching broadcasts and mailings.** The `watchers` table, `watch()`,
   `<Watching>`, and the "you're now watching" line; existing ones start
   with their creator. Today's emails Cc all watchers, and `scheduler()`
   goes. _Done when_ every email about a broadcast or mailing reaches its
   watchers.
2. **Notifications, with one kind.** The tables, `notify`, `ended`,
   Dismiss, the sweep, email, strips and sidebar counts, with an MP's
   address bouncing end to end. _Done when_ it counts, shows, emails and
   clears.
3. **The kinds with a strip today.** _Done when_ the dashboard has no
   strips and `needsAPerson()` is gone.
4. **The kinds that only email**, a category at a time, with their _new_
   buttons, and the "letters-queue" health check. _Done when_
   `notifyStaff()` is gone.
5. **Your account's settings.**
6. **Discord.**
7. **Browser notifications**, if still wanted.
8. **Watching campaigns**: an MP's address bouncing and supporters' copies
   bouncing also go to the campaigns' watchers. Who starts watching a
   campaign is decided then.

## Open questions

1. Who sets "What you deal with": each person, or an admin, like a rota?
2. Should Press and Events be one category, "Outreach", as in the sidebar?
3. Which kinds must reach someone, and should they also go to admins?
4. A stray WhatsApp message's words reach only the notification inbox's
   email, so they're lost if that one send fails, and someone reading only
   the site can't see them. It's rare. Leave it as now, with the strip
   pointing at the inbox, or keep the words in its `facts` until it's
   dismissed, as an exception?
