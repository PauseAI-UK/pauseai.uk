# PauseAI UK website

The [pauseai.uk](https://pauseai.uk) website: Next.js 16 and React 19, deployed to Netlify.

## Features

- **Public site:** who we are, people's stories, local groups, blog (each post a file in `lib/content/blog/`, with an Atom feed, `/blog/feed.xml`), press, jobs, governance, donations, research.
- **Events:** from our Luma calendar, on `/events`, the home page and local group pages.
- **March sign-up:** `/protests/march-against-ai-extinction-nov-26` (and `/march`, which redirects there), for the March Against AI Extinction. The hero and the form show how many have registered, a count that comes from Luma. Registering adds the person to the march's Luma event, and the form then turns into a card asking them to share it.
- **Briefings:** `/campaigns/briefings`, from the Campaigns menu. Weekly AI news briefings, each a file in `lib/content/briefings/` and laid out as its designer's A4 briefing (`docs/code-structure.md`, "The weekly briefings"). They have an Atom feed of their own, `/campaigns/briefings/feed.xml`.
- **Email your MP:** `/campaigns`. A person finds their MP by postcode, then edits and sends a campaign letter. The letter goes from the letters inbox, a Gmail account of ours, under a proxy address, so the MP never sees the sender's own address. The MP's replies are relayed to the sender, and the sender's answers are relayed back. Staff see the whole thread.
- **Volunteer tools:** collateral maker and QR codes (`/tools`); live results of activity days (`/trackers`).
- **Staff interface:** `/staff`. Supporters, campaigns and their letters and replies, broadcasts to supporters, politicians and what they've signed, asks, mailings, one-off emails with politicians, our events and who on staff owns each, imports, blocked email addresses, sent emails, the audit log, errors on the site and staff accounts.
- **Component gallery:** `/gallery`, fixture builds only.

How they're built is in [docs/domain-concepts.md](docs/domain-concepts.md).

## Run it locally

With Node 24, Docker and `psql`:

```bash
npm install
docker compose up -d         # Postgres for the site and the tests
cp .env.example .env.local   # set TEST_MP_EMAIL to your email, and GMAIL_TOKEN_KEY to the output of `openssl rand -base64 32`
npm run db:reset             # makes the database, with the test MPs and plenty of fake data to look at
npm run dev                  # http://localhost:3000, with every outside service faked
```

Try Email your MP with postcode ZZ99ZZ; the letter lands in `tmp/outbox/`. The rest, including tests and real services, is in [docs/development.md](docs/development.md).

## Docs

- [docs/domain-concepts.md](docs/domain-concepts.md): the concepts the features are built from, and how to extend them
- [docs/development.md](docs/development.md): setting up local development in full
- [docs/code-structure.md](docs/code-structure.md): how the code is laid out, the staff features and which uses which, where new code goes, and the rules that hold it, including comments
- [docs/testing.md](docs/testing.md): how it's tested
- [docs/data-protection.md](docs/data-protection.md): what personal data the site holds, why, and how it's erased
- [docs/style-guide.md](docs/style-guide.md): design, and where to find every component
- [docs/march-links.md](docs/march-links.md): the tracked links to the march sign-up, and its analytics events
- [scripts/README.md](scripts/README.md): what each script does
- [backup/README.md](backup/README.md): the nightly database backup to Cloudflare, and restoring one
- [plans/](plans/): plans for work in progress, deleted when done
- [investments/](investments/README.md): what would make working here faster or safer, ranked, with the friction logged against each
- [AGENTS.md](AGENTS.md): notes for coding agents

## Deployment

Netlify: pushing to `main` deploys the live site, and pull requests get previews. The database is backed up nightly to Cloudflare ([backup/README.md](backup/README.md)). What has to be set up outside the code is in [docs/development.md](docs/development.md), "Deploying".
