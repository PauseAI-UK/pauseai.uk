# Testing

How this site is tested, and the rules for new code.

## The layers

| Layer           | Tool                                            | Tests                                                                                                                                                | Files                                      |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Logic           | Vitest, `node` project                          | `lib/`, the route handlers and Server Actions in `app/`, `netlify/`, `scripts/`, `next.config.ts`, `proxy.ts`, and the checks in `tests/checks/`     | `*.test.ts` (or `.tsx`) next to the code   |
| Components      | Vitest, `browser` project (real Chromium)       | every component                                                                                                                                      | `*.browser.test.tsx` next to the component |
| Pages and flows | Playwright, the storyboard (`desktop`, `phone`) | every route loads cleanly; every flow a person takes, end to end on fixture data; run with screenshots, the same flows pictured against main's build | `tests/storyboard/`                        |

**Vitest Node** is for anything that doesn't need a DOM. **Vitest Browser
Mode** renders a component on its own in real Chromium, so layout, canvas,
`matchMedia` and the clipboard all behave as they do for users.

**Playwright** runs against a real production build (`next build && next
start`), so it is slower. Use it only for what Vitest can't see:

- `page.tsx` and `layout.tsx`: `tests/storyboard/public-pages.spec.ts` loads
  every public route (from `tests/routes.ts`) and checks it returns 200, logs
  no console errors or hydration warnings, has one `<h1>` and has no broken
  same-site links.
- Redirects, navigation, scrolling and hash links.
- The onboarding iframe.
- Anything remembered from one page to the next.

## Coverage

`npm test` runs both Vitest projects and produces one report in
`coverage/`. CI fails if it drops below the thresholds in
`vitest.config.mts`.

While writing tests, `npm run test:changed` is quicker. It:

- runs only the tests for the files changed since `origin/main`, committed
  or not (Vitest's `--changed`);
- measures coverage of only the changed source files;
- lists each one's lines not run, functions not called and branches not
  taken.

It reports coverage even when a test fails, which `npm test` doesn't:
Vitest skips the report, and the thresholds with it, when any test fails.
Anything after `--` goes to Vitest (`npm run test:changed -- --project
node`). A change to `package.json` or the Vitest config makes Vitest run
every test. It isn't the gate: `npm test` is, over every file.

Because a failing test hides the coverage, a check that's meant to fail for
days isn't a Vitest test. The check for placeholder copy is a command of its
own, `npm run placeholders` (`scripts/placeholders.mjs`), so a branch whose
copy waits for approval still has its coverage checked.

- **Every file is held at 100%**: statements, branches, functions and
  lines, each file on its own (`perFile: true`).
- **Code that needs a browser is tested in the browser project**, even when
  it isn't a component: the collateral tool's canvas drawing, its PDF and
  zip exports, and its font embedding all have `*.browser.test.ts` files.
- **Defensive data checks are functions.** A module-level guard over static
  data (`checkPeople`, `checkPostAuthors`, `assertOutletsValid`) can't fail
  in a test, so it lives in an exported function that tests call with bad
  input.
- **Every source file is in the report**, including files no test imports
  (they show as 0%). So an untested component fails the gate rather than
  going unnoticed.
- **No ignore comments.** `v8 ignore`, `c8 ignore` and `istanbul ignore` are
  banned (`tests/checks/coverage-ignores.test.ts` fails on one). If code is hard to
  reach, test it in the browser project, or restructure it so it can be
  tested.
- **The one scope rule:** `page.tsx` and `layout.tsx` are outside the
  report. Async server components can't render in Vitest, and `layout.tsx`
  needs `next/font`. That's safe only because they have no branches:
  `tests/checks/thin-pages.test.ts` parses every one and fails on `if`,
  `? :`, `&&`, `||`, `??`, `?.`, `switch`, a loop, `try` or a default
  value. A choice a page would make goes in a component or a `lib/`
  helper, where the gate covers each way it can go:
  - `found()` (`lib/found.ts`) gives the post, person or record a URL
    names, or a 404;
  - `lib/staff-search.ts` has the staff pages' URL filters;
  - `LoginForm` has the login page's states.

  The route smoke test then only has to show each page renders.

## Mocking

Mock only where the site calls an outside service. All such calls go
through `outsideFetch`, from the bindings in `lib/server/outside-services/`
(`docs/code-structure.md`, "Outside services"), and the canned responses
live in one place: `lib/server/fixtures/outside-services.ts`.

- **Vitest Node:** MSW (`tests/fixtures/msw.ts`) answers every outside
  request from the fixtures. A request with no fixture fails the test. To
  test a different response, use `server.use(http.get(...))` in the test.
- **Vitest Browser:** components receive data as props, so pass fixture data
  in. `next/navigation` is mocked in `tests/vitest.setup.browser.tsx`, since there
  is no Next router.
- **Playwright:** the build runs with `DATA_FIXTURES=1`, so `outsideFetch`
  returns the fixtures instead of calling Luma or Airtable. Use `page.route`
  only for browser requests that mustn't really happen (form submits to
  other sites). The storyboard's fixtures (`tests/storyboard/fixtures.ts`)
  deal with what a page loads from other sites:
  - Analytics loads only on the live site (`lib/analytics.ts`). The fixture
    build turns it on so the consent flow can be driven, and the fixtures
    block every request to Google for every flow.
  - The two embeds from other sites have stand-ins, since what the real
    ones draw, and when, varies between runs. pauseai.info's signup form is
    a fixed-height box, and Tally's story form on /people doesn't load.
  - Pictures from other sites, such as Luma's event covers, are one local
    picture. The build resizes such a picture after fetching it over the
    internet, and fetching the real one can time out.

Don't stub `fetch` globally, and don't mock our own modules to make a test
pass. Mocking one of our modules is fine at an edge the test can't
otherwise watch or break: the collateral tool's file downloads, an image
that fails to load, or a check result a real design can't easily produce.
Wrap the real module (`importActual`) and replace only that one function.

## Email

Emails go through Postmark's HTTP API
(`lib/server/outside-services/postmark.ts`) or Gmail's (`gmail.ts` beside
it), as the letters inbox or a staff member's connected account. Both go
through `outsideFetch` like any other outside service.

- **No Postmark library.** The `postmark` npm package makes its own HTTP
  requests, which would bypass the fixtures in Playwright builds.
- **Vitest checks what we sent.** The Postmark fixture just returns a
  `MessageID`, and the Gmail one its IDs. Tests read the request MSW
  received:
  - `recordGmail()` (`tests/gmail-sends.ts`) records what goes by Gmail.
    `lib/server/mp-letters.test.ts` uses it to check a letter's From, To,
    text and attachments.
  - `notifications()` (`tests/notifications.ts`) records what Postmark is
    asked to send, for the emails to the notification inbox.
- **Playwright reads an outbox.** With `DATA_FIXTURES=1`, `sendEmail`,
  `sendGmail` and `sendRawGmail` also write each outgoing email to a mail
  file (`.eml`) in `OUTBOX_DIR` (`lib/server/fixtures/outbox.ts`). The flow
  test checks the letter in the newest email to the test MP. This is
  test-only plumbing, with no production route or table.
- **The storyboard pictures the emails.**
  `emailFrame(page, email, caption)` (`tests/storyboard/email-frame.ts`) shows an
  email from the outbox as a frame, in a plain mail app's layout
  (`tests/fixtures/email-view.ts`): its headers, its body (the HTML if it
  has one) and its attachments. Every email the site sends has one, such as
  the letter, a relayed reply and the staff login link. It's what was sent,
  not how Gmail or Outlook draw it.
- **And the WhatsApp texts.** The fake WhatsApp writes each text to the
  outbox as a text file (`.txt`): its template's name and fields, or words
  of our own (`lib/server/fixtures/whatsapp-outbox.ts`).
  `textFrame(page, from, text, caption)` (`tests/storyboard/whatsapp-steps.ts`)
  shows one as the supporter gets it,
  in a plain chat app (`tests/fixtures/text-view.ts`): our picture, name
  and number, then the text in a bubble with its footer.
  WhatsApp keeps a template's words, so `shownText` in
  `tests/storyboard/whatsapp-steps.ts` reads them from the flow's database
  and fills in the fields from the file.

  So that the frames compare, the fixture build fills in what would be
  random: the `Date` header is the fixed clock's, and a login link's token
  comes from a seed (`randomId` in `lib/server/random-id.ts`).

  A fixture build knows the address it's served at (`FIXTURE_ORIGIN`, from
  `lib/server/fixtures/fixture-env.mjs`, which both fixture builds use), as
  the live site knows its own. So every link in an email is whole, whether
  or not the code that sent it had a request. Each checkout serves its build
  on its own port, so every frame (an email, a text or a page) shows the
  site's address as `pauseai.example.org` wherever its text has the server's
  (`showOrigin` in `tests/storyboard/frame.ts`), and main's frames and a
  branch's don't differ by it.

- **Gmail and Outlook are checked from the HTML.** `lib/letter-format.test.ts`
  runs the letter's HTML through doiuse-email
  (`@jsx-email/doiuse-email`, the Can I email tables,
  https://www.caniemail.com) for every Gmail and Outlook app, and fails on
  anything they don't support. `lib/plain-email-html.test.ts` does the same
  for the HTML made from a text email. Paying a service to picture the real apps
  (Litmus, Email on Acid) gives pictures that vary run to run, so it isn't
  in CI.
- **Webhooks are posted directly.** Tests post bounce, spam complaint and
  inbound payloads, in Postmark's format, straight to our routes with test
  basic auth credentials. They check that wrong or missing credentials are
  refused, and that a reply is forwarded and logged without its text.
- **No Mailpit or other mail catcher.** We send through Postmark's and
  Gmail's APIs, not SMTP, so a mail catcher would test a different path from
  production.
- **Checking real sending by hand.** On previews and the live site, use the
  test MP (postcode ZZ99ZZ). Postmark's test token `POSTMARK_API_TEST`
  accepts messages without delivering them.

  For a real bounce, write to Bouncy McTestface MP (ZZ99ZH). Their address,
  `no-such-mailbox@pauseai.uk`, doesn't exist, so pauseai.uk's mail server
  refuses it, whichever service sends the letter. The letter shows as
  bounced on its campaign's page. The site then blocks the address, so the
  next letter to it waits until staff unblock it at
  `/staff/politicians/addresses-to-fix`. Postmark's own addresses at
  `bounce-testing.postmarkapp.com`, such as `hardbounce@` and `softbounce@`,
  also produce real bounce webhooks. None is used in CI.

## The storyboard

One Playwright suite, `tests/storyboard/`, drives the site's flows end to
end on a fixture build. A spec file is a **section**, a test a **flow**, and
each `await frame(page, "caption")` a **frame**: a caption and, when
screenshots are on, a screenshot. The checks go between the frames. The
tests know nothing about main.

A frame makes one check of its own, the storyboard's only check of
layout. On the desktop, a frame of a staff page fails its flow if a date
in one of the page's tables is on two lines
(`tests/storyboard/table-dates.ts`): "16 Oct 2026" or "16 Oct 2026,
10:34", broken anywhere within it. It runs with screenshots on or off, so
the gate fails on it too. It reads where the browser drew each date, so a
flow has only to visit a list for its dates to be checked. Phones are left
out, as a phone's tables scroll sideways. The fix is in the table, not the
flow: a column of dates is a short one, and a date among other words is a
`When` (`docs/style-guide.md`, "Lists").

Each spec file declares its section after its imports: its name on the
review page, the heading it goes under, and its place there, in tens, so a
new one fits between two:

```ts
import type { Section } from "./report/frames";

export const section: Section = { name: "Write to your MP", part: "Public site", order: 20 };
```

The review reads that line from the file's text (`Section` in
`tests/storyboard/report/frames.ts`), so keep it in that form.
`frames.test.ts` fails if a spec file has none. A new spec file also needs
a line in "What the storyboard covers", below.

**How a flow is told.** The review page reads as a story of each flow,
for anyone who has used the site or the staff pages, in three kinds of
words:

- **The title** names the flow, like a chapter heading: "The letter
  bounces", "Automatic replies", "An MP who has signed (ZZ99ZS)". It
  doesn't try to say what happens. `public-pages` titles each flow with
  its route, and the gallery with its group.
- **A caption** says what the frame pictures, and no more: "The letter's
  page", "The email staff get".
- **The story**, `story("…")` (`tests/storyboard/frame.ts`), says what
  happens and why, a line or two at a time: one at the start of the flow,
  and more between the frames. The page shows each line above the next
  frame. A line after the last frame ends the flow, and a flow with no
  frames is told by its story alone. Write each line where it happens in
  the spec, so the code and the story read together.

They're written from the point of view of the person using the site, a
supporter or staff, in the words the site and the staff pages use
(letters inbox, relayed, blocked address, mailing, ask), and plainly: what
happens, not how the test fakes it. A fixture, a route or a webhook is
named only if a person would see it. For example:

```ts
test("The letter bounces", async ({ page, request, flowDatabase }) => {
  story("Jane writes to an MP whose address bounces her letter. The address is blocked, and staff get an email.");
  // … the letter, and its bounce
  await emailFrame(page, alert, "The email staff get");
  story("Jane is told, in the thread of her copy, that her letter hasn't reached her MP.");
  await emailFrame(page, notice, "The email Jane gets");
```

A frame pictures the whole page when the page is at the top, so its layout
can be looked over. Once a person, or a step, has scrolled, it pictures only
the window: where they are is then the point, and a full-page picture of a
scrolled page puts the sticky header wherever the scroll was. It also
pictures only the window while a menu or a dialog is open, as that is
placed against the window, which a full-page picture resizes.

A flow with no frames (the redirects, a scroll position, a header) says so
on the page: "Passed. No frames: this flow only checks."

```bash
npm run test:storyboard   # CI's run: desktop runs every flow, phone only those tagged @phone; no screenshots
npm run storyboard        # the review, and the gate's storyboard: the flows a change can reach, both viewports, screenshots, against main's frames (where this branch left origin/main), then opens the page
npm run storyboard -- --plan   # which flows the review would run, and why, running none
npm run test:report       # Playwright's own report, with the trace of a failed flow
```

**CI's run** fails only on a flow's checks, never on how a page looks. CI
runs every flow, in three parts at once, each a job of its own
("Storyboard (1 of 3)" and so on), and the Storyboard check passes when
all three have passed. `.github/workflows/ci.yml` says why. Locally, the
gate's storyboard is the review (`npm run gate`, below), so one run checks
the flows and pictures them.

**The review** (`scripts/storyboard.mjs`):

- works out which flows might show something new since the latest run
  ("Which flows a review runs", below), and carries the rest;
- runs those against this branch, with screenshots;
- takes main's frames from where they're kept, running main's own suite
  first for any that aren't ("Main's frames are main's own", below);
- pairs the frames by section, flow and caption, and diffs them pixel by
  pixel;
- opens the run's page (`test-results/storyboard/index.html` leads to the
  newest run's).

Main is where this branch left origin/main, the merge base a pull request
compares with. Nothing is fetched.

The page shows:

- The flows, in sections. Each frame has its caption and, on desktop and
  phone, this branch's picture, main's and the diff, which open in a
  lightbox. A phone/desktop toggle stays on the flow being looked at.
- A control to show all the flows, only those with changed frames (just
  those frames), only those that failed, or only those main is missing,
  with the count of each. Main is missing a flow it hasn't run, such as one
  new on this branch, or one whose run on main failed; each says which. Such
  a flow has nothing fair to compare with, so it isn't in Changed, and every
  one of its frames is there to look at.
- A box that filters flows by their section, title, captions or story (`/`
  to start, Escape to clear). The control's choice and the filter's words
  are kept on a reload.
- A failed flow's message, under its last frame.
- The sections under three headings: the public site, the staff pages, and
  the tools and checks. Each section has the name, the heading and the
  place under it that its spec file declares. The component gallery is
  last. The flows in each section are in their spec file's order.
- A sidebar that follows the page. The section in view is open and the
  flow in view is marked, and the rest are folded, but a section opened or
  shut by hand stays so.

The same data is in `test-results/storyboard/latest/storyboard.json`, for
an agent. Both are local only and gitignored. A difference never fails the
review. Only this branch's checks do, and the exit code is theirs.

**The storyboard's progress.** Every run of the storyboard, the review's
and the gate's alike, says how far through its flows it is in one file,
always at the same place in its checkout
(`tests/storyboard/report/progress.ts`):

```
test-results/storyboard-progress.json
{"kind":"review","side":"branch","pid":4242,"startedAt":"2026-11-12T10:00:00.000Z","updatedAt":"2026-11-12T10:03:45.000Z","total":566,"done":347,"failed":0,"ended":false}
```

It's written when the run starts, after each flow and when the run ends.
`kind` is which run it is: "review", with pictures on both viewports, or
"flows", the gate's lighter run, which only checks that every flow works
and so has fewer to do. `done` counts every flow that has finished, and
`failed` those of them that didn't pass. Anything that shows a run's
progress, such as a terminal's status line, reads this file, not the run's
output, which goes wherever whoever started it sent it. A run is going
while `ended` is false and the process `pid` is alive: one that was killed
never says it ended.

A review that has to run main's flows does that in main's own checkout,
and it takes as long as the branch's. That run writes to the same file,
the one in the checkout the review was started in, with `side` "main", so
one place says how far the review is and which half it's on.

When a review that stands for every flow ends, it records how it went, and
the commit and tree it pictured (`scripts/storyboard.mjs`):

```
test-results/storyboard-review.json
{"commit":"8fbe0082…","tree":"3c1d…","main":"0d3fde1e…","endedAt":"2026-11-12T11:24:30.000Z","complete":true,"full":false,"run":"2026-11-12T11-18-17","flows":566,"failed":0,"changed":1077}
```

A review stands for every flow when it ran them all (`full`), or chose
which to run itself, as every flow it didn't run would look as it did. So a
reader can say whether the code it's looking at has had its review: it has
if `tree` is that code's, uncommitted files and all. A run narrowed by
hand, to a section, `-g` or one viewport, doesn't write it. `main` is the
commit of main it was compared with, and `changed` is null for a review
with no run of main to compare with. The gate's status has the same `commit`, for its flows
(below, "The gate's status").

**The changed frames**, for an agent: `npm run storyboard:changed`
(`scripts/storyboard-changed.mjs`) prints the latest run's changed frames,
without running anything. Given another run's folder or name, it prints
that run's. They're the page's Changed: each frame that differs from main,
is new, or is gone. For each one it prints:

- its viewport, section, flow and caption;
- how much of it differs;
- the full paths of this branch's picture, main's and the diff, to open one
  by one.

Before the frames, it lists the flows that failed. After them come the
page's Main missing: each flow main hasn't run or failed, saying which, with
every frame it shot and its path, as none of them is in Changed. The
paths are in the run's own folder, not `latest/`, so they stay right after
another run. `npm run storyboard -- --changed` runs the review and then
prints the same.

**The copy to approve**, for the person who writes the copy. After every
storyboard review of a branch with placeholders, run `npm run copy` and
give that person the page's path. It (`scripts/copy.mjs`) writes
`test-results/copy.html`. It's one page, with
its pictures in it, of each placeholder (AGENTS.md, "Never write final
copy") that this branch adds or changes since it left origin/main,
committed or not.

A sidebar lists every piece of copy in clusters, in the diff's order. A
piece's cluster is its file, or for `lib/content/` the set of strings it's
in (the copy object's top-level key, such as
`staff-interface.ts › broadcastPages`). Clicking a piece (or <kbd>j</kbd>
and <kbd>k</kbd>) shows it alone:

- the copy as written;
- its file and line, and the source, folded;
- every frame of the latest run that pictures it, each the whole page with
  the copy boxed, scrolled to it.

Frames that are the same picture with the copy in the same place are listed
under one, and each picture is in the page once, however many pieces of
copy it shows. Copy that no frame pictures is in italics: it needs a flow,
or can't be reached (an `aria-label`, a message shown only on an error).
Copy with the same text in two places is shown once, with both places.

Each frame records the placeholder text it pictures and its boxes
(`placeholdersOnPage` in `tests/storyboard/frame.ts`, kept in
`storyboard.json` as each frame's `placeholders`). A placeholder runs from
its mark to the next mark, or to the end of the block it's in. It's read
from the page without changing it, so no picture changes. A field's
placeholder or value counts, and so does a select's chosen option. So does
the text of an email's frame, so an email's copy is matched where a flow
frames the email.

The script reads the copy from the source:

- a string, to its end;
- a template, with each `${…}` as anything;
- JSX text, through inline elements (`<strong>`, `<a>`, `<Link>`), with
  each `{…}` as anything;
- HTML in a string (an email's), to its first block.

Whitespace is collapsed and entities are decoded on both sides. A frame's
text matches copy that starts it, and the longest match wins.

```bash
npm run copy                         # from the latest run, without running anything
npm run copy -- <run>                # another run: its folder, or its name under runs/
npm run copy -- --storyboard         # runs the storyboard first (the rest goes to it: --no-main, --desktop)
```

`--storyboard` runs the sections whose frames showed the changed copy in
the latest run, if they showed all of it. If some of the copy was in no
frame, it runs the whole suite, as that copy could be anywhere. Without
`--storyboard`, the page says when the run is older than the branch's last
commit, or older than a file with changed copy, as its frames may not show
the copy as it is.

**Runs.** Each run has its own folder,
`test-results/storyboard/runs/<when>/`, with every picture its page shows,
so a page you have open is never changed by the next run. `latest` points
at the newest run that finished, and `index.html` beside it opens that
run's page by name. The newest five runs are kept.

A partial run is one that selects less than the whole suite: a section,
`-g`, `--desktop` or `--phone`, or the flows the review chose. It starts
from the latest run's frames, as hard links, and replaces only the flows it
runs, so the review stays whole. Each carried flow says when it was shot,
and the summary line counts them. A flow that's gone from the suite,
renamed or deleted, isn't carried. A full run starts empty. A review may
start from a tree the store keeps instead (below), its pictures linked
into the run's folder in the same way.

**Which flows a review runs.** Given no selection of its own,
`npm run storyboard` runs only the flows that might show something new, and
carries the rest, so every review is as small as the change. Each flow
keeps these with its frames (`frames.json`):

- `tree`, the tree of the code it ran on, when the build was that tree's:
  Playwright built it for the run. With a server already up, whose build
  may be older, a flow records none, and the next review runs it again.
- `setup`, a hash of the dependencies installed (`node_modules`) and the
  Node running them, which the tree doesn't hold.
- `opened`, what it opened: each page, action, API route and public file,
  by its path (`tests/storyboard/fixtures.ts`). The fixture build's server
  keeps the address of every request it gets from a flow
  (`scripts/record-requests.mjs`), which includes each step of a redirect
  and any browser the flow starts for itself, and the flow's browsers add
  each address their pages come to. Next's prefetches of the pages a link
  points to don't count; following the link does. One entry isn't a path:
  `instrumentation.ts`, when the server kept an error during the flow
  (`errors_seen` changed), as nothing imports what handles one. A flow on
  a build whose server kept none of its requests (main's, for
  `--this-suite-on-main`) records nothing, so it's never carried.
- `recording`, which way of recording `opened` made the record
  (`RECORDING` in `scripts/storyboard-reach.mjs`). Add one to it whenever
  the recording changes what a record holds: a flow recorded another way is
  run again.
- `seen`, on a flow a review carried: the tree it was carried at. The
  next review asks what changed since then, as what changed before was
  found not to reach it.

The review then runs (`scripts/storyboard-reach.mjs`, `flowsToRun`):

- each flow with nothing to carry: new to the suite, failed last time,
  recorded without its tree or another way, or run on other dependencies;
- each flow that the files changed since its tree, or since it was last
  carried, can reach;
- when one of those files reaches every flow, every desktop flow, and the
  phone's tagged ones, as CI runs;
- when the map can't place one of those files, every flow.

It carries the rest from the latest run here, or from a tree the store
keeps (below), whichever leaves fewer to run. So a new worktree's first
review starts from main's frames and runs only what the branch changed.
With nothing to run, it runs nothing: the page is every flow carried,
beside main as it is now. `--plan` says which flows a review would run,
and why, and runs none. `--full` runs every flow regardless.

What a flow can reach:

- its spec file and what that imports;
- for each page it opened, the files Next renders it with (its `page.tsx`
  or `route.ts`, and each `layout.tsx`, `error.tsx` and the like from its
  folder up) and what they import. Where two routes could serve an
  address, both count;
- what every flow runs: `next.config.ts`, `proxy.ts`, Playwright's set-up
  and the fixture server's, and what they import.

So the storyboard keeps what a flow reaches to what it pictures:

- A flow signs in straight to the page it's going to (`logIn` and
  `logInAsStaff` in `tests/storyboard/login-steps.ts`), so only the flows
  about the staff home open it.
- What flows share is in a file of steps for each area beside the specs
  (`login-steps.ts`, `letter-steps.ts`, `politician-steps.ts` and so on),
  so a spec imports only what it uses. A helper only one spec uses is in
  that spec. `tests/routes.ts` walks `app/`, so only the specs that walk
  every route import it.
- `fixtures.ts` and `frame.ts`, which every spec imports, import nothing
  of the site but small constants. An email is pictured by `emailFrame`, a
  module of its own (`email-frame.ts`).
- `next.config.ts` takes the addresses its redirects need from
  `lib/content/redirect-addresses.ts`, not from the content they belong to.

Imports of types alone (`import type`) don't count, as they're gone once
compiled. A stylesheet's `@import` and `composes` do. So does code handed
to a module without an import (`HANDED_OVER`): `lib/server/problems.ts` is
told how to find the run in progress by `run-store.ts`, and what keeps an
error by `instrumentation.ts`, so a flow that reaches the one reaches the
others. A changed file reaches the flows whose reach has it, and some
files reach more:

- **Every flow:** the migrations and `schema.sql`, the seed data
  (`tests/fixtures/*.sql`), `package.json`, `next.config.ts`, `proxy.ts`,
  `instrumentation.ts`, `playwright.config.ts`, and the storyboard's set-up
  (`EVERYTHING`). Data no import leads to can change any page.
- **No flow:** docs, plans, investments, unit tests, the review page's own
  code, and the settings of the tools that don't build the site
  (`NOTHING`), unless a flow imports one.
- **`staffCopy`:** a change to `lib/content/staff-interface.ts` reaches the
  files that read the top-level keys it changed (`staffCopy.letters`, or
  `const { letters } = staffCopy`), and any that import the file without
  naming a key. A line outside the object reaches every file that imports
  it.
- **The gallery:** each group's flow reaches its own examples
  (`_examples/forms.tsx` and `forms.client.tsx`), though the index it picks
  them from imports every group's. A plain stylesheet (not a
  `.module.css`) applies to every page that loads it, so it reaches every
  group.
- **Data** (JSON, a picture, a font, a fixture's email, a CSV a flow
  uploads) reaches the flows that reach a file naming it, or naming its
  folder as somewhere to read from. A public file also reaches the flows
  that fetched it.
- **A route's own file**, added or deleted as well as changed, reaches the
  flows that opened an address it serves (a layout's, any below it).
- **A file added or deleted** reaches the flows that reach a file listing
  its folder: the sitemap and `tests/routes.ts` walk `app/`.

**A file the map can't place** runs every flow, and the review says which
file, at its start and its end: a file at the top of the repo that nothing
imports (a build tool's settings), data that no file names, or a file Next
serves at an address of its own (`opengraph-image`, `icon`). Teach
`scripts/storyboard-reach.mjs` what such a file reaches, or log a hit on
`investments/storyboard-review-speed.md` naming it. Its tests check, on
the repo as it is:

- that every import in what the site and its flows run can be followed
  (none of a file that isn't there, none of anything but a plain string);
- that the site's code hands no code over without an import but where the
  map knows of it: no module calls an imported function as it loads, and
  none uses `globalThis`, but those the test lists;
- that the files the map names by their paths exist.

**Spot checks.** A review that carries flows also runs six of them
anyway, chosen by a hash of the tree and the flow, and compares each with
what it would have carried, as the review compares a frame with main's.
It does so even when the change reaches no flow, unless nothing changed
but docs and unit tests. If
one looks different, the map missed something in the files changed (or a
frame differs from run to run): the review says which flows, at once and
at its end, and runs every flow. Find what the map missed and fix it, or
log a hit on `investments/storyboard-review-speed.md` naming the flows.

The map can't see what isn't in the tree: an environment file, or the
machine's fonts and browser. And it takes a page that Next prefetched,
which a flow never went on to open, to have changed nothing the flow
shows: true while rendering a page writes nothing. `investments/storyboard-review-speed.md` has
how it was checked against what runs in each flow, and
`investments/narrow-imports.md` the imports that make a change reach many
flows.

**Main's frames are main's own.** They come from main's suite, run on
main's build, in a checkout of main's own: a git worktree in your temp
folder (`scripts/main-checkout.mjs`), kept with its `node_modules` and
Next's cache, where Playwright builds main and serves it as it does a
branch. Nothing of this branch's goes into them. So:

- A frame that differs from main's shows everything the branch changes:
  the site, and the flow's own steps too.
- A flow or a caption the branch renames no longer pairs with main's: it
  shows as one gone and one new.
- A flow the branch adds has no frames on main, and all of its are new.

**They're kept by tree.** The same tree gives the same pictures, whatever
branch or checkout it's in, so every flow a run finishes is kept under the
hash of the tree it ran (`scripts/storyboard-store.mjs`), in the main
checkout's `test-results/storyboard-frames/`, which every worktree shares:
each picture once, by its contents, and the thirty trees used most
recently. These put frames there:

- **A run of main.** The review looks for main's tree first. If every flow
  it needs is kept, it doesn't touch main's checkout at all. Otherwise it
  lists main's flows (`playwright test --list`, which builds nothing),
  runs main for just the flows not kept (`playwright test --test-list`),
  and keeps them. A flow that failed is kept too, to show as failed on
  main, and is tried again by the next review. So main runs once for each
  commit of main, for every branch and worktree off it.
- **A review of a branch.** Its frames, the flows it carried as well as
  those it ran, are kept under the tree of the checkout as it was,
  uncommitted files and all: each carried flow looks as it would on that
  tree, or the review would have run it. When the branch merges, main's
  tree is that tree if nothing else merged in between, and its frames are
  there already. They're kept only if Playwright built the site for that
  run (no server was already up, and no `--server`) and nothing in the
  checkout changed while it ran, as only then is the build known to be that
  tree's. A run narrowed by hand (a section, `-g`, one viewport) keeps
  nothing, as the flows it didn't run weren't chosen as unchanged.
- **Another kept tree.** Before running main for the flows not kept, the
  review looks for the kept tree nearest main's: of each, the flows that
  recorded their tree and what they opened, less those the change from
  the tree each ran on to main's can reach ("Which flows a review runs").
  From the one that leaves fewest to run, it carries the rest into main's
  tree, and runs main for what's left. After a merge or a rebase, that's
  usually what the last PR changed. A review of a branch carries from a
  kept tree in the same way, when that leaves fewer flows to run than the
  latest run here does, or there's none.

A flow kept under a tree it didn't run on keeps the tree it did run on
(`tree`), so the next review asks what changed since then. One that ran on
the tree itself is never replaced by one carried there. `--fresh-main`
runs main whole, replacing what was carried, and lists any carried flow
that looks different run afresh, past the review's noise: a change the map
missed.

A review needs every flow of main's, and a run narrowed by hand those of
its own flows that main has. Either shows main's frames of every flow
that's kept, so the flows a review carries are beside main as it is now.
`npm run worktree` starts the same thing in the
background as it makes a branch (`npm run storyboard -- --only-main`), so
the first review needn't wait: a review started meanwhile waits for it to
finish. `--fresh-main` runs main again regardless.

Main's build is served on a port of its checkout's own, and the review
won't run main while something already answers there, such as a server
left from a run that was stopped: Playwright would take it for the build
it had just been asked for. Stop that server.

**`--this-suite-on-main`** runs this branch's suite against main's build
instead, for the flows that took pictures here, as the frames then differ
only by what the site does. It's for a branch that changes how frames are
pictured (`frame.ts`, `playwright.config.ts`, Playwright's version), where
every frame would otherwise differ from main's own. `scripts/serve-main.mjs`
builds and serves main for it, its output in `main-server.log` in the
run's folder, or `--main-server=URL` names a server you started. Nothing
of it is kept, so main runs each time. A flow that asks main for something
it doesn't have fails there within seconds: an action gives up after ten
(`actionTimeout` in `playwright.config.ts`).

**Noise.** A frame that differs from main's only by antialiasing isn't
counted as changed, by the rule toucan's snapshot gallery uses
(https://git.sr.ht/~frabcus/toucan, `platform/snapshots/png.ts`):

- a pixel differs when a colour channel moves by more than 4 levels;
- a frame has changed when its differing pixels' moves add up to more than
  2,000, or more than 1,000 pixels differ.

Antialiasing on a few glyphs comes to a few thousand, and a line that moves
by a pixel comes to millions. A frame under the limits reads "same as main,
but for noise" and still shows its diff, so you can see what fell under
them. The limits are `CHANNEL_NOISE`, `NOISE_TOTAL` and `NOISE_PIXELS` in
`tests/storyboard/report/frames.ts`.

Every frame is pictured a pixel to a CSS pixel, on the phone too, though
its screen is 3×. The layout is what a frame shows, and that way there's a
ninth of the pixels to take, keep and compare.

Switches, after `--`:

- `--no-main`: this branch alone;
- `--main=<ref>`: another branch;
- `--desktop` or `--phone`: one viewport;
- `--no-open`: the page left closed;
- `--paths`: print each frame's caption and picture;
- `--changed`: print only the changed frames, as above;
- `--server=URL`: a server you started for this branch;
- `--fresh-main`, `--only-main`, `--this-suite-on-main` and
  `--main-server=URL`: as above.

Anything else goes to `playwright test`: a file (`staff-login`),
`-g login`, `--headed`.

So the review is also the way to get a screenshot while working. One page
is `npm run storyboard -- --no-main --no-open --paths public-pages -g
'/donate$'`, which takes a few seconds on a warm build. `public-pages` names
each test by its route. A narrow run carries the rest of the latest review,
so it doesn't lose your last full one.

**Every flow stands alone.** It passes on its own, and run twice, in any
order, alongside the others:

- **A database per flow.** `tests/storyboard/global-setup.ts` makes one
  migrated template database with the test MPs. The `flowDatabase` fixture
  (`tests/storyboard/fixtures.ts`) copies it for each flow
  (`CREATE DATABASE … TEMPLATE`, tens of milliseconds), names the copy in a
  cookie on the browser context and the `request` fixture, and drops it
  afterwards. In a fixture build only, `lib/server/db.ts` reads that cookie
  and queries the database it names, through one small pool per database,
  closed when idle. Otherwise it queries the database `NETLIFY_DB_URL`
  names. Flows that need the fixture politicians import them with
  `importPoliticians()` (`tests/storyboard/politician-steps.ts`). So the staff pages that list
  what's happened, like `/staff/campaigns`, are compared unmasked.
- **A fixed clock.** `FIXTURE_NOW` (`lib/server/fixtures/fixture-env.mjs`)
  is the moment every clock is fixed to:
  - the server's: `now()` in `lib/now.ts` reads it, and the server uses
    `now()` instead of `new Date()`;
  - the database's: its `now()`, and the columns that default to it, are
    fixed to the same moment in each flow's database;
  - every page's: its clock is set to that moment with `page.clock`.

  Nothing date-shaped is masked.

- **A seeded hero.** `lib/shuffle.ts` shuffles the same way every time in a
  fixture build, so the home page's hero is compared too.
- **Seeded emails.** In a fixture build, a login link's token is made from
  a seed, and an email's `Date` is the fixed clock's, so the pictures of the
  emails are compared too ("Email", above).
- **Unique identifiers.** A flow's staff login address includes its test ID
  (`staffEmail` in `tests/storyboard/login-steps.ts`), and each address it
  makes up for a supporter has a number no other flow uses (`madeUpAddress`
  in `tests/storyboard/fixtures.ts`), so two flows never share a letter or a
  link.

**Rules:**

- Every new interactive behaviour goes in a flow, existing or new, with a
  frame after each thing a person would see. A PR without it isn't done.
- Every flow is told: a title that names it, captions that say what each
  frame shows, and its story ("How a flow is told", above).
- Every email the site sends is pictured: the flow that sends it shows it
  with `emailFrame` (`tests/storyboard/email-frame.ts`), right after it's sent.
  A new email, or a change to one, isn't done until its frame is in a
  flow ("Email", above).
- Flows stay small: one thing a person does, about ten frames at most.
  Sections split past a dozen flows.
- A flow's title names it, as the review's sidebar lists it, so someone
  scanning it knows which flow is which ("How a flow is told", above):
  - A few words, sentence case, no full stop, and no colon listing what
    comes of it: the story says that.
  - The words on the site, not the code's: "Log in", "Connect Gmail",
    "Addresses to fix", never "RSC payload", "Server Action" or
    "hydration".
  - Unique in its section: the review pairs a flow's frames with main's
    by section, title and caption. Main's are from main's own spec files,
    so a renamed flow shows as one gone and one new.
- Tag a flow `@phone` to run it on the phone in the gate too. Tag it
  `@phone-only` if it only makes sense on the phone (the mobile nav), or
  `@desktop-only` if it only makes sense on the desktop. The review runs
  every other flow on both viewports.
- Before saying a change is done, run `npm run storyboard` and look at
  every changed frame on both viewports. Say what changed in the PR. An
  agent lists the changed frames with `npm run storyboard:changed` and
  opens each.
- A flaky flow, or a frame that differs between two runs of the same
  build, is fixed at once, never retried, skipped or masked ("Rules for new
  code", below). `retries` stays 0.
- No fixed waits. A flow waits for the thing it's waiting for.
  `tests/storyboard/settle.ts` has:
  - `hydrated`: mounted, fonts in, console quiet;
  - `scrollSettled`: a smooth scroll at rest;
  - `layoutSettled`: images in, nothing moving;
  - `wholePage`: back at the top, and staying there, for a frame after a
    click, typing or going back has left the window somewhere that varies
    between runs.
- Playwright's own output (traces) is in `test-results/playwright`
  (`test-results/playwright-storyboard-*` for a review), and is emptied
  every run. The reviews beside it in `test-results/storyboard` are kept,
  the newest three.
- No stored baselines, and no gate on pixels. Main is the reference.

### What the storyboard covers

Every page is loaded:

- `public-pages.spec.ts` opens each public route in `tests/routes.ts` (one
  example per dynamic route). It leaves out a campaign's write and preview
  pages, which show nothing without a postcode and a letter and are
  pictured by the `campaigns` flows instead. It also leaves out the
  component gallery's pages, which `gallery.spec.ts` pictures.
- `staff-login.spec.ts` checks every staff page turns a visitor without a
  session away.
- `permissions.spec.ts` loads each staff page logged in, with no
  permissions.

The flows below drive the rest. `tests/storyboard/coverage.test.ts` fails
if a spec file or a route handler (`route.ts`) is missing from this list.
So a new one is placed here on purpose, on a line of its own, with the flow
that drives it or why nothing does.

- `public-pages.spec.ts`: Every public route: 200, one `<h1>`, no console errors or hydration warnings, no broken same-site links, fixture text where a page shows data.
- `campaigns.spec.ts`: Email your MP, end to end:
  - the postcode, the letter, the preview and the sent page, and the letter the MP gets;
  - the editor's toolbar and a paste, and the letter as sent;
  - the draft kept through Edit, back and reload;
  - going back;
  - an email typed in the address's first line, refused;
  - a refused letter;
  - the pages opened out of order;
  - each campaign, and the nav's links to them;
  - the campaign pages in search and the sitemap, and the old `/campaigns-v2` links redirecting;
  - the special test MPs.
- `briefings.spec.ts`: The briefings: the Campaigns menu's link to them, the index of cards, a briefing on its sheet with its calendar, budget and signatories charts, a source from its mark, and back.
- `replies.spec.ts`: Letters through the letters inbox. Every email, both ways, is pictured, and the letter's history after each:
  - the letter sent from the supporter's proxy, and her copy, a reply to which goes to the MP's proxy;
  - the MP's reply relayed to her, and her answer relayed to the MP;
  - a reply with HTML and an attachment, relayed unchanged;
  - automatic replies relayed both ways, then a loop of them stopped at the cap, with staff emailed;
  - on the letter's page, an automatic reply folded to its first paragraph, then unfolded;
  - an email from a stranger, a forged reply and spam: none is relayed, and the run fails, listing them;
  - the letter bouncing: staff are alerted and the supporter is told, then it's sent again once the address is unblocked;
  - a bounced letter a week on: the supporter is told it won't be sent, and unblocking the address sends nothing;
  - the supporter's own address bouncing: the next reply is held, the day's report of supporters' bounces goes to the notification inbox, and the MP's office is told a day on;
  - a letter over the daily limit: it's queued, the notification inbox is emailed once it has waited three hours, and it's sent after a relay that was waiting;
  - a letter with a paragraph of the supporter's own and a sentence cut, shown as only its changes, with the rest folded, and as sent;
  - a reply to an old letter, through Postmark, forwarded and kept whole on the letter's page;
  - erasing Jane when her kept mail can't be cleared, which the list says.
- `home-events.spec.ts`: The home page's events:
  - in person near a postcode, or only online;
  - a postcode not found;
  - near the device's location, and nothing near;
  - a local group's events, with its venue set or not;
  - the address bar saying which events are shown, and a link to a local group's events or the online ones.
- `march-signup.spec.ts`: The march sign-up:
  - the page under the site's header, without the march banner, its marker-pen marks drawn;
  - how many have registered, in the hero and the form, asked for again on coming back to the page;
  - the hero's words in line with the header and the page below, in a wide window;
  - registering, Luma failing, and an email the server won't take;
  - See all details, to the day's details;
  - a heading highlighted as it comes into view;
  - the share card, saying they're registered, its apps all showing on a desktop and a row to swipe on a phone, and registering someone new, with the events sent to GA.
- `staff-login.spec.ts`: Logging in to the staff pages, and your own account:
  - login by emailed link, with the email pictured: it works once, in the browser that asked for it;
  - an address outside pauseai.uk getting no link;
  - the dev login;
  - a link with Keep me signed in;
  - the staff home after a first login, which makes an account with no permissions, and its dashboard over 30 days;
  - as an admin, adding an account from Add staff, editing its permissions in a bubble, and removing it with a second press, with the note of what that leaves them;
  - every staff page turning a visitor without a session away, and the API changing nothing for them;
  - your own page with your Gmail connected and disconnected, and a wrong Google account;
  - logging out, and noindex.
- `staff-navigation.spec.ts`: The dashboard, and getting around the staff pages:
  - the sidebar folded to a rail of icons, each where it was, with a name on hover, and still folded on the next page;
  - a sort's arrow turned at once, and a line along the top while a sort or a search loads;
  - another page marked in the sidebar at once while it loads (its table locked, `lockTable` in `tests/storyboard/loading-steps.ts`);
  - the dashboard's tabs, kept on going back, and a bar pointed at;
  - the events held tile leading to those events, and the supporter emails tile leading to those emails in Correspondence;
  - the politicians agreed tile, leading to the one politician who agreed and then to everyone who agreed, newest first;
  - a politician's page, and the list sorted by a heading;
  - setting a status that shows on `/campaigns`, and the audit log;
  - the "new" tag, on the sidebar and the folded rail, and gone after 3 days.
- `imports.spec.ts`: The imports staff run and watch:
  - the Scheduled jobs page and each job's own page, with Parliament's import run twice on its page;
  - a held politician import, of 21 MPs Parliament no longer lists: the notification inbox is emailed, the home has an action for it, and it's discarded, then applied;
  - an import held for a renamed politician;
  - the Luma import run twice from its page;
  - the CiviCRM import, skipping an erased contact;
  - the logs of Luma, the Gmail reading and CiviCRM, a table a day, with the newest run's tinted row, rows, a row for quiet runs, a problem's tinted rows and a folded stretch;
  - the connected Gmail read from its page, and the button pressed again while the scheduled read is going;
  - an import failing, with Luma down for the flow (`lib/server/fixtures/failing-services.ts`), and one with problems, with postcodes.io down: the notification inbox is emailed once, though the import fails twice;
  - a Gmail that Google disconnects, with the notification inbox emailed;
  - the letters inbox's own page, back from connecting its Gmail;
  - what Joseph's own page says once his mailbox is connected and kept;
  - the daily email to staff listing mail in policy@ that matched nothing.
- `staff-campaigns.spec.ts`: Campaigns, asks and sent emails:
  - campaigns: the list by the month of each one's last letter, a campaign's page with its versions, its counts choosing its letters, and `/staff/letters` redirecting;
  - asks: the list under its months, with each ask's answers, how it was asked and its counts;
  - an ask's page, for a letter and for an event: its answers in columns, those who gave one answer, by page, under the columns' tops, the link to those who answered on the politicians list, and its form at `/edit`;
  - a mailing's list and page naming its ask and who it's from;
  - Sent emails, as an admin, searched and filtered, and closed without the permission;
  - a new ask, changed and deleted.
- `letters.spec.ts`: Letters and their bounces:
  - Correspondence: a test MP's left out, then shown with Test politician chosen; a supporter's and a mailing's, one with its reply in its link; sorted by topic; those replied to; and the dashboard's tile;
  - the letters list (one sent, one bounced), filtered by status, then by campaign, then either of two campaigns, then reset and sorted by sender;
  - a letter with only an automatic reply and one with a written reply: the Replied column, the Status filter's options, and the list filtered by what came back;
  - a supporter's letter's page, with no Gmail search as its text is there, and the MP's answer to its campaign's ask set from it;
  - a bounce emailing staff and blocking the address, and the home's action for it;
  - an MP whose address is blocked, unblocked by staff.
- `politicians.spec.ts`: The politicians from each body's list:
  - one with markers, notes, answers and PauseAI's emails;
  - her correspondence, its switch to replies only, the band's counts leading to it and to her asks, and the list sorted by emails from them, with the same counts;
  - a note added on one, above Airtable's;
  - an ask staff added, chosen from the button under a politician's asks and answered;
  - a letter a politician declined, recorded from that button, then cleared;
  - a peer, an MSP and an MP who left office;
  - the list filtered by status, marker (then all but that marker, by its chip) and an answer, then reset;
  - the house tabs;
  - paging through many;
  - searching by each word, for those not in office and the nearest to a typo;
  - the politicians mailed about an ask, and those not yet;
  - the two marks switched on and off in their card;
  - a Lord's email set from the bubble on it in the band, and an MP's, with no email to set;
  - a salutation made from the name, set to Ms from its bubble's choices;
  - ControlAI's statement imported, and its ask's page;
  - several answers to an ask, ticked in the chip's second half;
  - PauseAI's email to one, from her history, and its Gmail search copied;
  - her own Gmail added to her aliases, the next Gmail read finding her email from it, and the list sorted by last activity, which that email dates.
- `mailings.spec.ts`: Mailings to politicians, the old ones and those written on the site:
  - the mailings, one mailing's recipients, and a politician's history leading back to it;
  - a mailing's ask leading to its page;
  - New mailing, then who it's for ticked on the politicians list, with its strip and the bar at the foot;
  - New mailing on the list with no filter, which makes an empty draft with no one ticked;
  - the new mailing written, previewed and sent to yourself as a test (the email pictured);
  - Mail these on the list, with everyone it found ticked;
  - Change who, back on the list's ticked tab, with one more searched for and ticked, then everyone unticked to start again and one ticked;
  - the draft naming her, and the draft deleted;
  - names pasted from the bar's Paste names, its box opening above it: a row copied from the table found by the name in it, one name found by constituency and one near a typo, a row each on the Paste names tab, and all ticked with the box over them;
  - one unticked on the ticked tab, and the draft saying who it's to as the group found less one;
  - a scheduled mailing given a new time, then unscheduled and a draft again;
  - one sending, and one sent with its failed tab, leading to the bounced letter's page under the mailing;
  - one whose run stopped while sending, finished by the next run with that letter uncertain, and the letter's page;
  - a mailing's letters bouncing, the MPs on the dashboard and the day's report to the notification inbox;
  - one stopped part-way, with every way a letter fails on its failed tab, its stopped tab, pressed again for everyone, and its sent tab;
  - one sent from your Gmail in a From name of its own, by the sending job, and the reply read from it.
- `broadcasts.spec.ts`: Broadcasts to supporters:
  - New broadcast on the Broadcasts page: the writer is greyed till its Consent is chosen, which makes the draft to everyone who said yes, and then its Consent is changed;
  - the list's Broadcast button with a Consent filter;
  - an email written, from hello@ by its Gmail with what it can send today, previewed, sent as a test, scheduled and unscheduled;
  - a text on an approved template, with the templates' search and Show all;
  - a text on new words, sent for WhatsApp's approval, locked till it decides, then rejected by its webhook;
  - a new template WhatsApp won't take, too long, with its reason in a red alert under the button;
  - new words WhatsApp approves by its webhook, with the email saying so, then ready to schedule;
  - who it goes to changed from the list, with its Consent locked there;
  - an email and a text sent, with their counts, recipients and each one's copy, and on the supporter's page, made in the database as sending would make them;
  - an email sent by the sending job, by hello@'s Gmail, and a copy as the supporter gets it, with its unsubscribe link;
  - an email with more copies than hello@'s Gmail can send today: some sent and the rest tomorrow, then stopped three days after its time, with the email saying so, and set going again by Resume sending;
  - one waiting for CiviCRM, with the email saying so and its page;
  - a reply asking to stop, to look at on the email's page, recorded as an opt-out from its thread;
  - a reply answered from its thread, by Gmail from hello@, and the email the person gets;
  - one to the newsletter's and events' yeses both, ticked as about our events;
  - a text sent by the sending job, by the fake WhatsApp, then delivered and read by its webhook;
  - a reply to a text by WhatsApp's webhook, as a bubble, answered from its thread by WhatsApp;
  - Stop pressed in WhatsApp, on the copy and the supporter's page.
- `email-settings.spec.ts`: The contact preferences page:
  - asking for a link past Turnstile, the email with it, and the page it opens;
  - changing what you get, with why behind a “?” on a phone;
  - Stop everything, and Restart undoing it, texts and calls too;
  - an email's unsubscribe link, fresh, opened again once used, and two months old, with a fresh link emailed;
  - a link that's run out;
  - “No bulk emails” lifted, and “Do not email”, “Do not SMS” and “Do not phone”, which only PauseAI Global can lift;
  - an address we can't email, as its emails bounced;
  - the email to someone with “No bulk emails” who ticked the march's box.
- `events.spec.ts`: Events and their owners:
  - the Luma import giving events their owners by the rules, and the email to the owner;
  - new events tagged on Luma, and the email asking about one it can't tell;
  - the events page's Future tab, with the event whose owner by the rules has no account in red;
  - its Edit bubble, with an owner chosen and its Google Doc pasted, saved, and the email to the owner;
  - the Past tab, latest first, sorted by how many went, and searched;
  - for staff who see supporters, each event's hosts, searched by a host's name, and a host's supporter page with the events they host;
  - on a busy calendar, the lists by owner, No owner first, with a list's fold opened and an event given an owner from its line;
  - the lists by tag, with an event in two lists, each with its own Edit;
  - the lists by owner without online events, on Future then Past;
  - an event earlier today staying on Future and in the lists by owner, and yesterday's on Past.
- `audit-log.spec.ts`: The audit log's filters:
  - by who;
  - a chip's row swapping;
  - the + Add menu, each tick changing the list while it's open;
  - by how recent, and sorted;
  - one left out, then the chip turned round;
  - several chosen opening as boxes, Just one, and unticking the last;
  - ticking quickly, with an older answer held back;
  - one lozenge where an entry has one value;
  - leaving out every choice;
  - its search, saved, and its download;
  - without `supporters`, the filters and the saved filters, but no entries about supporters.
- `saved-filters.spec.ts`: Saved filters on the staff lists:
  - saving one, loading and editing it, finding one by name, renaming and deleting;
  - none saved, and part of one gone;
  - a saved filter on Events;
  - who can see them;
  - loading one while choosing for a mailing or a broadcast.
- `supporters.spec.ts`: The supporter pages:
  - closed without the permission;
  - notes on a supporter: one added with a link, then edited, an admin with no Delete on a colleague's old note, and one from today deleted, in the audit log;
  - the list after the Luma import, searched, filtered, filtered to nobody with its frame kept, cleared from the row that says so, and sorted;
  - those not at an event, chosen by Except, who declined it or never registered, then by its chip only those at it;
  - an MP's constituents, by the MP filter, named in the page's title;
  - a supporter's page with their MP and an opt-out from the webhook, then subscribed again, and the audit log, which records a download of the supporters but not a look at one's page;
  - a supporter merged into another by their mobile number, whose old ID's page redirects to the one kept;
  - a letter writer reached from the letters page;
  - a march sign-up, with what they gave and the link they came by;
  - the list's Consent column, and its filter: those who can't be emailed about events, then the newsletter;
  - members: one who also wrote to their MP, one CiviCRM says never opted in, one with "No bulk emails" there, with what a topic is from its ?, and one who unsubscribed there;
  - a hold in CiviCRM in Bounced emails, lifted with a note;
  - erasing a supporter from its own page, who stays gone through the next import, and a member, who stays gone through the next CiviCRM import;
  - subscriptions to more than one topic, in one chip, its answer changing them all;
  - an opt-out told to staff, recorded under a supporter's consents with how it was given;
  - in a fixture build, a supporter's contact preferences opened from their page.
- `signup-uploads.spec.ts`: Import sign-ups:
  - files written different ways, linked to an event or not;
  - a hundred rows at once;
  - rows held back, then fixed and uploaded again;
  - files it refuses;
  - what Luma says;
  - what changes before importing;
  - Past imports, and an import's page;
  - someone with "No bulk emails" marked in the preview, with the email they'll get, and someone with "Do not email".
- `errors.spec.ts`: What goes wrong outside an import:
  - a staff page that throws: Next's error page in its place and Reload, the email to the notification inbox, once though it fails twice, the errors list and the error's own page;
  - a page breaking in someone's browser, on the fixture build's page that breaks (`/broken`): the email that quotes none of it, and a click that throws, kept without an email;
  - the spam check down for someone sending a letter, with Cloudflare down for the flow: what they're told, the email and the error's page;
  - an error marked done: its page's button, then the list's To do and Done tabs;
  - an error done happening again: back with those to do;
- `permissions.spec.ts`: What staff see by permission:
  - the accounts sorted by when last seen;
  - logged in with none: every staff page, as HTML and as its RSC payload, holding no supporter's name or email (the leak check);
  - an admin without `supporters`: sent emails, the audit log and its download holding none either, each saying so;
  - an MP's letters without who wrote them;
  - Letters and Bounced emails closed without `supporters`, and Addresses to fix naming a letter without linking it;
  - a supporter's bounced address in Bounced emails, unblocked, and Addresses to fix with nothing in it;
  - logged in on two browsers, your address in the sidebar leading to your account page, and logging out of both from there;
  - an admin seeing each account's last login, last seen and sessions, and logging a colleague out everywhere.
- `collateral.spec.ts`: The collateral maker, one flow per studio: a single image from a calendar event, a campaign pack, a gallery; each to its downloads.
- `consent.spec.ts`: Cookie consent remembered across pages, analytics switched off and on, never on the tools.
- `mobile-nav.spec.ts`: The burger menu on a phone: open, close, dropdowns, navigating, scroll lock released.
- `onboarding-embed.spec.ts`: The home page's signup iframe: shows after slow hydration, ignores other origins.
- `scroll.spec.ts`: Anchor links, deep links, the back button, keyboard focus, reduced motion, the footer's cookie link, the embed not scrolling the page.
- `gallery.spec.ts`: The component gallery ("The component gallery", below): its index and a flow per group, a frame of each component's section, each checked for noindex and console errors.
- `redirects.spec.ts`: Every redirect in `next.config.ts`, over HTTP, and that each destination resolves.
- `/api/email-your-mp/lookup`: `campaigns`: the postcode form (`lookUpTestMp` in `tests/storyboard/letter-steps.ts`).
- `/api/email-your-mp/letters`: `campaigns`: sending the letter (`sendLetter`).
- `/api/events/place`: `home-events`: events near a postcode.
- `/api/march/register`:
  - `march-signup`: registering, Luma failing, and an email the server won't take.
  - `supporters`: a sign-up kept, on the supporter's page.
- `/api/march/signups`: `march-signup`: the count asked for again when the page comes back into view. Vitest-tested beside it.
- `/api/unsubscribe/[token]`: a mail app's one-click Unsubscribe, which a person never sees, so no flow drives it; Vitest-tested with the page's actions (`app/(site)/contact-preferences/actions.test.ts`).
- `/api/postmark/bounce`, `/api/postmark/inbound`, Postmark's webhooks. Replies to the letters that the letters inbox sends, and their bounces, come through `read-gmail`, below.
  - `campaigns`: both routes turn away a post without Postmark's credentials, and a bounce for an email that isn't a letter changes nothing.
  - `letters`, `mailings` and `permissions`: Postmark's bounce payloads, for a letter, a mailing's letters and an email we can't place.
  - `replies`: a reply to an old letter's own address.
- `/api/signatories`: `staff-navigation`: setting a status, then reading the public list.
- `/blog/feed.xml`, `/campaigns/briefings/feed.xml`: `public-pages`: each feed, its type and entries, and its link in the head of its section's index and a post's page.
- `/api/cron/[job]`, each scheduled job's run (`lib/server/jobs.ts`), Vitest-tested beside it for every job:
  - `import-parliament`, `import-scottish-parliament`, `import-senedd`, `import-ni-assembly`: `importPoliticians()` in `tests/storyboard/politician-steps.ts`, at the start of the staff flows that need politicians, which then gives them their Airtable records' details; `imports` runs Parliament's again to hold it.
  - `import-controlai`, `import-controlai-statement`: Not driven. The `staff-navigation` and `politicians` sections run them through their buttons.
  - `tidy-logs`: Not driven: nothing a person sees changes but its run on its own page.
  - `send-mailings`:
    - `mailings`: a mailing scheduled from your Gmail, then started and sent by the job.
    - `replies`: `runQueue()` in `tests/storyboard/letters-inbox-steps.ts` runs it, for the letters the letters inbox has queued.
  - `read-gmail`:
    - `replies` and `letters`: `readInbox()` in `tests/storyboard/letters-inbox-steps.ts` runs it, after a flow puts a reply or a bounce in the letters inbox.
    - `imports`: the read that finds Google has disconnected a Gmail. The Gmail page's button runs the same `readGmail()`.
    - `mailings`: not through the route. A staff member's fixture Gmail has no messages to read, so the flow adds the reply that the read would keep.
  - `import-luma`: `supporters`: `importLuma()` in `tests/storyboard/supporter-steps.ts` fills a flow's database from the fixture calendar; the `imports` page runs it too.
- `/api/backup/messages`: Not driven: it's for the backup's container, and shows nothing. Vitest-tested.
- `/api/csp-report`: Not driven: a browser posts to it only on a CSP violation. Vitest-tested.
- `/api/browser-error`: `errors`: a page breaking in someone's browser, which the error page posts, and a button's click throwing, which the listener does.
- `/api/whatsapp`: `broadcasts`: WhatsApp's webhook, signed as Meta signs it (`postWhatsAppWebhook` in `tests/whatsapp-webhooks.ts`): a template approved and rejected, a text delivered and read, a reply, and Stop pressed. Its check of the callback URL is Vitest-tested.
- `/api/luma/webhook`: `supporters`: Luma's unsubscribe and subscribe webhooks for a supporter, signed as Luma signs them (`postLumaWebhook` in `supporters.spec.ts`), and the redelivery that changes nothing.
- `/staff/api/login`, `/staff/api/callback`: `staff-login`: asking for a login link and opening it (`logInWithLink` in `staff-login.spec.ts`).
- `/staff/api/logout`: `staff-login`: logging out, and the request without a session.
- `/staff/api/gmail/connect`, `/staff/api/gmail/callback`:
  - `staff-login`: your Gmail connected from your own page.
  - `mailings`: the same, reached by the link in a mailing's Sent from.
- `/staff/api/dev-contact-preferences`: `supporters`: their contact preferences, from their page, a fixture build's link per address; its links to an email's unsubscribe page, per topic and for an old email, go to the page as `email-settings` pictures it.
- `/staff/api/dev-login`: `staff-login`: the dev login, a fixture build's one-click sign-in as a seeded account. Every other section logs in with it (`logInAsStaff` in `tests/storyboard/login-steps.ts`).
- `/staff/mailings/[id]/files/[file]`: Not driven: the mailings flows' files are drawn from it, but no flow opens one. Vitest-tested.
- `/staff/broadcasts/[id]/files/[file]`: Not driven, as the broadcasts flows attach no files. It's the twin of the mailings' route, and is Vitest-tested.
- `/staff/politicians/download`, `/staff/supporters/download`, `/staff/politicians/addresses-to-fix/download`, `/staff/supporters/bounced-emails/download`, `/staff/audit-log/download`, the lists' downloads. Each route is Vitest-tested beside it.
  - `politicians`: the list of 250 opens its Download menu and downloads the CSV, every page of it.
  - `supporters`: the supporters as vCards, which the audit log records.
  - `audit-log` and `permissions`: the audit log's download. It holds what the search found, and without `supporters` nothing about supporters.
  - The two downloads of blocked addresses aren't driven.

**Not compared:** the live site. A diff of the public pages against
pauseai.uk would fail on every run, as live data changes under it (events,
news, caches, the clock). Bugs only real data shows, and configuration drift on
Netlify, aren't caught here; check previews by hand.

## The component gallery

The gallery shows every component, and each of its major variants, rendered
on fixture data, a page per group. `/gallery` lists the groups: the design
tokens, the UI kit and its forms at both densities, the header and footer,
each area of the site, the tools, and the staff interface in several
groups. `/gallery/<group>` (`/gallery/ui`, `/gallery/staff-letters`) shows
that group's components, with a link to each at the top. The gallery exists
only in fixture builds (`DATA_FIXTURES=1`). Production answers 404, and the
pages are noindex.

- **Look there first.** Before making a component, find out whether one
  already does the job, and how the site's pieces look side by side. With
  `DATA_FIXTURES=1` in `.env.local`, `npm run dev` serves it at
  http://localhost:3000/gallery.
- **Where examples go:** `app/(tools)/gallery/_examples/<group>.tsx`, one
  entry per component, `{ name, file, variants: [{ label, render }] }`. One
  that needs state or callbacks goes in the `.client.tsx` beside it.
  `tests/checks/gallery.test.ts` fails if an exported component has none.
- **A major variant** is a prop that changes how the component looks (a
  `variant`, a size, with and without an image). States someone reaches by
  using a page (open, submitted, an error) belong in the storyboard's
  flows, not here.
- **Callbacks do something.** A controlled input sits in `<Controlled>`,
  which holds its value and shows it. An action gets `log("onSave")` from
  `<Logged>`, which lists each call and its arguments under the component.
  Both are in `_components/wiring.tsx`.
- **Example data is test data:** obviously fake names, addresses and
  text, as in the browser tests, not copy.
- **To check a component by eye**, picture its group on both viewports, a
  frame per component, and open the PNGs (`--paths` prints them; an agent opens them with its file
  reader):

  ```bash
  npm run storyboard -- --no-main --no-open --paths gallery -g 'gallery: ui$'
  ```

  Drop `--no-main` to see main's beside it. The full review pictures every
  group anyway, so a change to a shared component shows wherever it's used.
  A component above it that changes height doesn't change its frame: each
  is moved onto a whole pixel before it's pictured, as text is drawn a
  shade differently at each fraction of one (`onWholePixels`,
  `tests/storyboard/frame.ts`).

- Knip leaves the gallery out (`knip.config.ts`): it imports every
  component, so they'd all look used.

## The database

Code that reads or writes the database is tested against a real Postgres,
not a mock.

- **Each test file gets its own database.** Wrap the tests in
  `describeWithDatabase` and call `useTestDatabase()` (`tests/database.ts`).
  It copies a template database, empties every table before each test but
  those whose rows the migrations seed (`SEEDED` there), and drops the copy
  afterwards. So a new table needs nothing adding. `addTestPolitician()`
  and `addTestMp()` add rows.

  The node project's global setup (`tests/vitest.global-setup.node.ts`)
  makes the template once for the run, applying the migrations with `psql`
  (`scripts/fresh-database.mjs`, the same way Netlify does), and drops it
  at the end. Postgres copies a database's files, so a copy takes tens of
  milliseconds however many migrations there are. Every file running the
  migrations itself, all at once, outlasts the hook timeout on a loaded CI
  runner.

- **Jobs that can overlap** (a scheduled run, its background twin and a
  press on its page) are tested running at once: `atOnce()`
  (`tests/at-once.ts`) starts several runs together on the test file's
  database, and the test checks each letter, guest or message was handled
  once (`lib/server/sending-job.test.ts`, `lib/server/luma-import.test.ts`).
- **A data migration gets a test while its tables are still changing.** A
  migration that moves or reshapes rows, not only tables, is tested with
  `useDatabaseUpTo()`:
  1. it makes a database with the migrations up to the one before;
  2. the test fills it with rows shaped the old way;
  3. `migrate()` applies the migration and every migration after it;
  4. the test asserts on today's schema.

  So the test also checks that later migrations, and today's code, cope
  with data shaped the old way. It's slower with each migration added, so
  once production has run the migration and nothing is changing the tables
  it touched, delete its test. `netlify/database/migrations.test.ts` still
  applies every migration to an empty database.

- **Where Postgres is.** The tests look for the server in this order:
  - `TEST_DATABASE_URL`, from the environment or from that one line of
    `.env.local`: `db-test` in `docker-compose.yml`, say;
  - without it, the usual `PG*` variables;
  - without `PGHOST`, the local server's socket in `/var/run/postgresql`
    or `/tmp`, or else localhost.

  So in the dev container, with Postgres started (`pg-start`), nothing
  needs setting. When no server answers, the tests stop, saying where they
  looked and what to do (`noServer` in `scripts/fresh-database.mjs`). CI
  runs a Postgres service.

- **Netlify's build has no Postgres**, so `npm run build` skips these tests
  there (`NETLIFY=true`), and the global setup makes no template. CI runs
  them.
- **The storyboard** builds against its own database, made fresh by the
  `webServer` command (`scripts/serve-fixture.mjs`), and gives each flow a
  copy of a template database (above). Each checkout has its own
  databases. The names in `tests/checkout.mjs`, for the databases, the
  outboxes and main's worktree, end with a hash of the checkout's path, and
  the ports come from that hash too (below). So worktrees can run the
  storyboard at the same time. Flows that need politicians call
  `importPoliticians()` (`tests/storyboard/politician-steps.ts`), which runs each body's nightly
  import's route against its fixture list, then the copy from the Airtable
  fixture.
- **Staff screens** are reached through the fixture build's dev login
  (`logInAsStaff` in `tests/storyboard/login-steps.ts`): one request for a
  session, as a login link's callback gives. Given a staff page, it lands
  there, as a login asked for from that page does; without one, the flow
  opens the page it's going to itself. So only the flows about the staff
  home open it. The `staff-login`
  section logs in as staff do, asking for a link, taking it from the
  build's outbox and opening it in the same browser (`logInWithLink`).
- **`next/headers`** can't run outside a request, so Node tests of code
  that calls `requireStaff()` use `vi.mock("next/headers", () =>
import("@/tests/next-headers"))` and put the session cookie in
  `requestCookies`.
- **React's `cache()`** memoizes only while React renders a request, so in
  Node tests it calls straight through. `tests/request-cache.ts` memoizes
  as React does within one request, until `newRequest()`.
  `lib/server/page-loaders.test.ts` uses it to show that each staff page's
  loaders query once for both its metadata and the page.

## Rules for new code

- **A flaky test is fixed at once**, Vitest or Playwright, by whoever
  finds it, in the branch they're on, even when that branch has nothing
  to do with it. A test that sometimes fails, or a frame that sometimes
  differs, teaches everyone to ignore it, and then it hides a real
  failure. Never retry, skip or loosen it to get past it; find why it
  varies.
- A new component ships with its `*.browser.test.tsx` in the same PR.
- **A new component gets an example in the component gallery**
  (`app/(tools)/gallery/_examples/`, one per major variant), or
  `tests/checks/gallery.test.ts` fails. Look at it there on both viewports
  before calling it done ("The component gallery", above); the storyboard
  then pictures it in every review.
- **A page has no branches** (`tests/checks/thin-pages.test.ts`). Put the
  choice in a component or a `lib/` helper with its own tests.
- **The site's header and footer are drawn only by `SiteFrame`**
  (`tests/checks/site-frame.test.ts`), which draws them once however many
  layouts a page is inside, so a 404 inside a section's layout never shows
  two of each.
- **A caught error is rethrown or reported** with `problem()`, nothing
  writes an error to the log by hand, and every job runs as a run of
  the import log (`docs/code-structure.md`, "Rules"). Three checks fail
  otherwise: `tests/checks/caught-errors.test.ts`, which names its few
  exceptions, `problem-reporting.test.ts` and `cron-runs.test.ts`.
- **Tests find elements the way a person does**: by role and accessible
  name, label or text (`getByRole`, `getByLabelText`, `getByText`), or by
  the attributes the markup has for its state (`aria-expanded`,
  `aria-pressed`, `data-active`). Where there's nothing semantic to find,
  such as a chart's parts, use a `data-testid`. Never select by a CSS
  module's class (its name is hashed) or import one into a test. To check
  something visual, read its computed style, since a component's module
  loads with it.
- New logic in `lib/` ships with its `*.test.ts`.
- A new staff page, route handler or Server Action under `app/(staff)/`
  must call `requireStaff()` as its first statement, or `tests/checks/staff-auth.test.ts`
  fails. Each exported function is checked on its own, so every action in
  a `"use server"` file needs its own call.
- A staff component sets no width of its own: the page's grid and the
  measure do (`docs/style-guide.md`, "Staff pages"), or
  `tests/checks/staff-widths.test.ts` fails.
- A new staff page says which kind of page it is, and where it is under
  the navigation's pages, and its title is one of the two heads'
  (`docs/style-guide.md`, "Kinds of page"), or
  `tests/checks/staff-page-kinds.test.ts` fails.
- A date in a staff table stays on one line, or the flows that picture
  the table fail ("The storyboard", above).
- A new page needs nothing extra: the route list picks it up. A new dynamic
  route (`[slug]`) needs an example in `tests/routes.ts`, or
  `tests/routes.test.ts` fails.
- Run `npm run storyboard` on any PR, and look over every changed frame on
  both viewports (above).

## Commands

```bash
npm run gate              # the CI gate: the fast checks on the changed files, then everything CI runs (below)
npm run gate -- --fast    # the fast checks alone
npm run typecheck         # types (also runs in npm run build)
npm test                  # both Vitest projects, with the coverage gate (what CI runs)
npm run test:changed      # the tests for the files changed since origin/main, and those files' uncovered lines and branches
npm run test:node         # Vitest node project (also runs in npm run build)
npm run lint              # ESLint, failing on warnings too (also runs in npm run build)
npm run lint:css          # Stylelint (also runs in npm run build)
npm run lint:unused       # Knip: unused files, exports and dependencies
npm run format:check      # Prettier, on everything .prettierignore doesn't list (npm run format fixes it)
npm run placeholders      # fails on placeholder copy, naming each line (also runs in npm run build)
npm run test:browser      # Vitest browser project
npm run test:watch        # Vitest in watch mode
npm run test:storyboard   # Playwright: every flow, without screenshots, as CI runs them
npm run storyboard        # Playwright: the flows a change can reach, with screenshots, against main (--full: every flow)
npm run test:report       # open the last Playwright report
```

- `npm run build` runs the placeholder check, the types, the Node project
  and the linters first, then `next build`. Only the Node project, because
  Netlify's build has no browser. While any copy is a placeholder,
  `npm run placeholders` fails, and so does the build: placeholders can't be
  deployed (AGENTS.md).
- **Ports.** The storyboard builds and starts the site itself on this
  checkout's own port, or reuses a server already there (except in CI). The
  port, and main's beside it for the review, come from a hash of the
  checkout's path (`checkoutPorts` in `tests/checkout.mjs`): between 3100
  and 4999, so never the dev server's 3000, and each worktree has its own.
  `npm run worktree` prints a new worktree's ports, and
  `node scripts/worktree.mjs --ports` prints this checkout's. Every response from a
  storyboard build names the checkout it was built from (the
  `X-Fixture-Checkout` header, `next.config.ts`), and the storyboard's global
  setup refuses a server on its port that doesn't name this one. It can't
  tell a stale build of this checkout from a fresh one, though: after
  changing code, stop a server you left running.
- Run one section with `npm run test:storyboard -- staff-login`, one flow with
  `-g "login link"`, or point at another fixture build with `LOCAL_URL`.
- Browser tests need Chromium: `npx playwright install chromium`.

### `npm run gate`

`scripts/gate.mjs` runs the gate as AGENTS.md describes it, in two parts.

**The fast checks**, in seconds: Prettier writes the files changed since
the branch left `origin/main`. That's since the merge base, as a pull
request compares, and it takes in committed, uncommitted and untracked
files. Nothing is fetched. Then these run at once:

- `tsc --noEmit`;
- ESLint on the changed scripts;
- Stylelint on the changed CSS;
- `scripts/migration-order.mjs` (new migrations after main's, and none
  sharing an open PR's number).

If one fails, the gate stops: the slow part would only wait on the same
mistake. `--fast` stops after them anyway.

**What CI runs**, in four lanes at once, as CI's jobs run:

- `npm run typecheck`, then `npm run storyboard -- --no-open` (the
  storyboard waits for the types, as in CI, and both write `.next`). It's
  the review, of the flows a change can reach ("Which flows a review
  runs"), so it counts for the review too, and finds nothing to run if one
  has already run on the same code;
- `npm test`;
- the four linters, then `npm run placeholders`, one after another;
- the backup Worker's `npm ci`, tests and types.

A lane stops at a failed `typecheck` or backup `npm ci`, as what follows
needs it. Each linter runs whether or not the one before it passed. A
branch with placeholder copy fails `npm run placeholders` alone, so the
table still shows whether its tests and coverage pass.
`--no-storyboard` leaves the storyboard out, for use while making changes.
`npm run build` isn't run: it repeats the unit tests and linters, and the
storyboard builds the site.

Each command has a time limit, from a minute for the migrations' order to
twenty for the storyboard. Its output goes to `tmp/gate/<command>.log`, and
that folder is emptied at the start of each run. A command stopped at its
limit exits 124, as `timeout` does.

Once a minute the gate names the commands still running. Once a command's
log has been quiet for two minutes, the gate also says how long, as that's
the sign of a run that's stuck (below). The gate ends with the last lines
of each failed command's log, then a table of every command's exit code,
time and log, and it exits 1 if any failed.

**The gate's status.** `npm run gate` says how each of its commands stands
in `tmp/gate/status.json` (`statusWriter` in `scripts/gate.mjs`), for the
same readers as the storyboard's progress (above, "The storyboard's
progress"):

```
{"pid":4242,"commit":"8fbe0082…","startedAt":"…","updatedAt":"…","ended":false,
 "groups":{"checks":"passed","test":"running","flows":"running"},
 "steps":{"prettier":"passed","tsc":"passed","test":"running","storyboard":"running","lint":"passed"}}
```

A step is `waiting`, `running`, `passed`, `failed` or `skipped`. `groups`
sums them up as the three things worth watching: the two long ones each on
its own, `test` and `flows` (the gate's storyboard, which checks that
every flow works, where the review pictures them), and `checks`,
everything else (the types, the linters, the placeholder check and the
backup Worker's package), which is quick. A group is failed if any of its
steps has, and running until all of them are done. Only the groups this
gate is running are there, so `--no-storyboard` has no flows. `commit` is
the one the gate started on: its result is of the code as it is now only
while that's still the checkout's commit. Like the storyboard's file, the
gate is going while `ended` is false and `pid` is alive.

### Long runs in the background

A run left in the background (`npm test`, the storyboard) that freezes or
dies without a last line can look like one still working. So give each a
limit, and check on it when it's due:

```bash
timeout 30m npm run gate > tmp/gate.out 2>&1          # its commands have limits of their own (above)
timeout 15m npm test                                  # usually about 5 minutes
timeout 15m npm run test:storyboard                   # usually a few minutes
timeout 25m npm run storyboard -- --no-open           # seconds to 7 minutes, by how many flows a change reaches, and longer when it has to run main
```

`timeout` stops the run at the limit and exits 124, so a run that ends that
way froze rather than failed. Write each run's output to a file, and its
exit code after it. When the time it usually takes has passed, look at the
file. A run whose output hasn't moved in minutes is stuck, so stop it and
find out why, rather than waiting for the limit.

A Vitest test file that hasn't finished in five minutes stops the run
itself, failing it and naming the file (`tests/hung-files.mts`, a reporter
in `vitest.config.mts`). A test's own limit runs in the page the test is
in, so it can't fire once that page is stuck: a component whose effect sets
state every time it runs renders for ever, and the run would otherwise sit
there printing nothing. Run the named file on its own to find the test.

Stopping a storyboard run can leave its fixture server (`next-server`)
running on the checkout's port (above). Locally the storyboard reuses
whatever answers there, so the next run waits on it, printing nothing. The
sign is a request to that port that hangs rather than being refused. Stop
that `next-server` before running again.
