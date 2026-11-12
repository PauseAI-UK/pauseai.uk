# Style guide

How the site looks, and where that lives in the code.

## Start with the gallery

The component gallery shows every component and its variants as the site
renders them. It's at `/gallery` on a fixture build (`DATA_FIXTURES=1`):
with that in `.env.local`, `npm run dev` serves it at
http://localhost:3000/gallery. It is the reference for what exists. Before
designing or building something, look there: the piece may already be
there, or need only a variant. `docs/testing.md` ("The component gallery")
says how to add to it and picture it.

The look lives in the components, not in this file. Each one owns its
styles in a CSS module beside it. The only global CSS is two files:

- `styles/tokens.css`: the fonts, every colour, width, space, type size
  and corner as a variable, and the compact density;
- `styles/base.css`: element defaults and `.container`.

The rules for writing styles are in `docs/code-structure.md` ("Styling").
Where this guide and the code differ, the code is what visitors see; fix
whichever is wrong.

## The look: warm authority

The site is warm, light and human-centred. It has to carry both gravitas
(we are serious, credible and organised) and friendliness (we are open,
hopeful and welcoming). It takes its cue from the brand image, a white
dove against a warm terracotta sky with bold black type: hope, peace and
determined action.

1. **Warmth over darkness.** Light backgrounds with warm undertones, not
   an all-black palette, so it feels inviting.
2. **Bold clarity.** A strong typographic hierarchy: headlines hit hard,
   body text breathes.
3. **Generous space.** Ample whitespace signals competence and calm. No
   visual clutter.
4. **Subtle depth.** Soft shadows and gentle layering give dimension
   without flashiness.
5. **People first.** Photography, rounded shapes and warm colours keep the
   focus on people, not technology.

## Colours

Every colour is a variable in `styles/tokens.css`, drawn on the
gallery's tokens page (`/gallery/tokens`). Stylelint refuses a hex,
`rgb()` with numbers or a named colour anywhere else, so a new colour is a
new token there. An alpha uses a token's `-rgb` channels:
`rgb(var(--white-rgb) / 0.1)`.

### Main colours

| Token              | Hex       | Usage                                 |
| ------------------ | --------- | ------------------------------------- |
| `--bg`             | `#FDF8F3` | Page background: warm cream           |
| `--surface`        | `#FFFFFF` | Cards, raised surfaces                |
| `--surface-2`      | `#F5EDE4` | Muted sections, alternate backgrounds |
| `--text`           | `#1A1612` | Text: warm near-black                 |
| `--text-secondary` | `#5C544A` | Secondary text: warm dark grey        |
| `--muted`          | `#8A7F73` | Captions and meta text: warm mid grey |

### Accent colours

| Token                        | Hex       | Usage                               |
| ---------------------------- | --------- | ----------------------------------- |
| `--accent`, `--pause-orange` | `#E57226` | The PauseAI orange: links, buttons  |
| `--accent-strong`            | `#E57226` | Hover states (the same orange)      |
| `--accent-light`             | `#F0D4BC` | Light accent fills, tag backgrounds |
| `--accent-bg`                | `#FFFFFF` | Accent sections                     |

### Border and shadow colours

| Token             | Hex                      | Usage                  |
| ----------------- | ------------------------ | ---------------------- |
| `--border`        | `#E8DDD1`                | Card borders, dividers |
| `--border-strong` | `#D4C4B0`                | Emphasised borders     |
| `--shadow`        | `rgba(26, 22, 18, 0.08)` | Soft card shadows      |
| `--shadow-strong` | `rgba(26, 22, 18, 0.14)` | Hover/elevated shadows |

`styles/tokens.css` also has the header and footer's dark colours
(`--charcoal`, `--on-dark`), warm tints, form greys and status colours
(`--danger`, `--status-green` and the rest). Use one of those before
adding another.

The palette is the brand image's: the terracotta sky is the accent, the
dove's white the surfaces, and the bold black type the text colour.
Everything is warm-toned, with no blue-greys or cool neutrals.

## Typography

### Fonts

```
Headings (h1, h2): Lato, weight 900 (700 for the page hero's title), via --font-display
Body and the rest: Inter, weight 400/500, self-hosted (public/fonts)
Accent labels:     Inter, weight 600, uppercase, tracked
```

Lato is bold and plain, commanding at heavy weights. Inter is clean and
legible at small sizes, and strong enough for subheadings.

### Type scale

Sizes are set in the components that use them. These are the main ones.

| Element         | Where             | Size                       | Weight |
| --------------- | ----------------- | -------------------------- | ------ |
| Page title      | `PageHero`        | `clamp(44px, 6.5vw, 84px)` | 700    |
| Section heading | `SectionHeader`   | `clamp(28px, 4vw, 44px)`   | 900    |
| Body            | `styles/base.css` | `16px` (`17px` in prose)   | 400    |
| Small / caption | each component    | `14px`                     | 500    |

### Line heights

- Headings: tight, around `1.1`
- Body text: `1.65` (`styles/base.css`)

## Spacing, type sizes and corners

All three are tokens in `styles/tokens.css`, and the gallery's tokens
page (`/gallery/tokens`) draws them.

- **Spacing** is an 8px grid, `--space-1` (4px) to `--space-9` (80px),
  with 4px and 12px for the tight places.
- **Type sizes** for interface text (labels, fields, notes, tables, tags)
  are `--text-xs` (12px) to `--text-lg` (18px). Headings and prose set
  their own in their components (the type scale above).
- **Corners** are `--radius-sm` (4px), `--radius-md` (8px: buttons,
  fields), `--radius-lg` (12px: cards), `--radius-xl` (16px: hero images)
  and `--radius-pill`.

In `components/ui/`, Stylelint refuses a raw `px` or `rem` in a margin,
padding, gap, font size or corner: they're tokens there. The kit's files
whose sizes aren't tokens yet are listed in `stylelint.config.mjs`. They
are there to be converted, and the list isn't to be added to. Elsewhere,
use the tokens where they fit.

### Using the spacing

Pick the step by how closely the things belong together: the closer they
belong, the smaller the step. A group's own items are always closer to each
other than the group is to what's around it.

| Step                     | For                                                                               |
| ------------------------ | --------------------------------------------------------------------------------- |
| `--space-1` (4px)        | Inside a small thing: a tag's padding, a note after a label, an icon and its word |
| `--space-2` (8px)        | Items of one kind side by side: a row of tags, a hint under its field             |
| `--space-3` (12px)       | A row of buttons or filters, a compact box's padding                              |
| `--space-4` (16px)       | A box's padding, a form above or below the list it filters                        |
| `--space-5` (24px)       | A card's padding, cards in a grid, one field to the next                          |
| `--space-6` (32px)       | Parts of a section: a heading to what's under it, one group to the next           |
| `--space-7`, `--space-8` | Big blocks of a page, and its top and bottom (48px, 64px)                         |
| `--space-9` (80px)       | A `Section` band's top and bottom                                                 |

- **Fields, tables and tags use the density's tokens, not `--space-*`**:
  `--field-gap` between a label and its control, `--form-gap` between
  fields, `--table-cell-padding`, `--tag-padding`. Then compact works
  without anything else changing ("Density", below).
- **Space things with the container's `gap`, not their margins.** A
  component sets its own padding, and the gaps between its own children,
  but not a margin round itself. Where it sits is its container's job,
  through `gap` or a `className` for its place in a layout
  (`docs/code-structure.md`, "Styling"). The exceptions are the few that
  always come after something and bring the space above them: `Hint` and
  `FieldError` (a `--field-gap` under their field), `ButtonRow` and
  `SmallPrint`.
- **Smaller on a phone by whole steps.** At a breakpoint, drop a step or
  two (`--space-6` to `--space-5`), rather than finding a value in between.

### When a value isn't a token

Spacing, type sizes and corners are tokens; most other sizes aren't, and
take whatever value they need:

- **Sizes that aren't spacing**: widths and heights (an avatar, a swatch,
  `--measure-page`), borders and outlines (`1px`, `3px`), line heights,
  shadows and offsets.
- **Space that grows with the text**: in `em`, such as a checkbox lined up
  with its label's first line (`Controls.module.css`). Stylelint allows
  `em`, since it isn't a fixed size.
- **Optical nudges**: a pixel or two to line an icon up with its text. Say
  in a comment what it lines up. A small icon before words in the staff
  pages needs no nudge. Put the icon and the words in `IconText`
  (`ui/IconText.tsx`), which centres the icon on the words wherever they
  are. Don't use a flex row of your own, as its baseline is the icon's
  bottom edge.
- **A size measured from something else**: the nav's height in
  `scroll-padding-top`, the heights reserved for the signup form while it
  loads (`OnboardingFormEmbed.module.css`). Say in a comment where the
  number comes from.

Outside `components/ui/`, an off-scale space or type size is allowed when
nothing on the scale looks right, with a comment saying why. Inside
`components/ui/`, Stylelint refuses one. For one of the cases above, use
`/* stylelint-disable-next-line declaration-property-value-disallowed-list -- why */`.

Don't add a token for a one-off. A new token is for a value two or more
components share, and it goes in `styles/tokens.css` with what it's for.

A page's widths are tokens too: its reading column is `--measure-page`
(880px), and a page of cards `--measure-wide` (1080px). `.container` is
1140px, unless a component narrows the containers inside it by setting
`--container-width` on its own root.

## Forms

Every field is the kit's, in `components/ui/`.
`tests/checks/form-controls.test.ts` fails on an `<input>`, `<select>` or
`<textarea>` written anywhere else; the few exceptions are listed there,
with why.

- **Fields** (`Field.tsx`):
  - `Field` is a label's words over the control inside it.
  - `Label` is a label on its own, over a control elsewhere or a group of
    buttons.
  - `Hint` is a note under a control.
  - `FieldError` says what's wrong, in the danger colour with an orange
    rule beside it. With `announce="alert"` it's read out, for a form that
    has just failed.
  - `FieldGroup` keeps a field and what's under it together.
  - `FieldSet` is a field of several controls, with its label as their
    legend.
- **Controls** (`Controls.tsx`): `TextInput`, `Select`, `TextArea`,
  `FileInput`, `Checkbox` (its label beside it), `Radio` and `Segmented`
  (a row of choices). A day is a `DatePicker` (`DatePicker.tsx`), and two
  of them are a `DateRange`.
- **Layout** (`Form.tsx`): `FormStack` is fields in a column. `FilterForm`
  is a row of filters over a list, lined up along their bottoms.
- **Focus**: every control and button has the same ring when it's focused
  from the keyboard: `--focus-ring` (2px of orange), set `--focus-offset`
  outside it.
- **Errors**: a field that's wrong has `aria-invalid`, which gives it a
  danger-coloured border, and a `FieldError` under it.

## Density

The same components come at two densities:

- **Comfortable** is the public site's: 48px fields, 16px labels.
- **Compact** is for screens of tables and filters that people work
  through, which is the staff interface. It has 36px fields (the small
  button's height, so a row of filters lines up), 14px labels and table
  text, and tight table cells and tags.

A container sets `data-density="compact"` on itself (`StaffPage` does), and
everything inside it is compact. The components need no prop.

Density changes only sizes and spacing, never colour, behaviour, the
focus ring or the look of an error. There are only the two densities. A
field's text stays 16px on a phone at either density, because otherwise
iOS Safari zooms the page when the field is focused. The tokens that
density sets are the `--control-*`, `--label-font-size`,
`--note-font-size`, `--field-gap`, `--form-gap`, `--table-*` and `--tag-*`
ones in `styles/tokens.css`. The gallery's forms page (`/gallery/forms`)
shows every field, table and tag at both densities.

## Staff pages

Every staff page is laid out from the same few pieces, so a component added
or removed doesn't bring a width, a box or an alert of its own. A
component's look is its own. Where it sits and how wide it is belong to
the page.

**Kinds of page.** Every staff page is one of these kinds, and says which:
its `page.tsx` returns `ui/Page` with its `kind`
(`lib/staff-page-kinds.ts`). A page's kind is how it starts and how it's
laid out, so a new page starts from the kind it is, not from a design of
its own. The gallery's staff kit has a skeleton of each.

| Kind         | What it is                                                 | It starts with                                 | Then                                                                     | Such as                                          |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| `list`       | Everything of a kind, to search and filter                 | the head                                       | tabs if it has views, the filter bar, the list frame, the window's width | Supporters, Politicians, Sent emails             |
| `month-list` | Things we made, newest first under their months            | the head, with the button for a new one        | a row for each, with its counts                                          | Mailings, Campaigns, Asks, Past imports          |
| `record`     | A main thing, which other pages lead to and count          | the trail, then the band                       | cards on the grid                                                        | a supporter, a politician, a mailing, an ask     |
| `item`       | A lesser thing, a part of a record or one run of something | the trail, then the head with a line of facts  | cards on the grid                                                        | a letter, a one-off thread, a scheduled job      |
| `form`       | Something to fill in                                       | the trail, if it's under a page; then the head | one card with help beside it, or numbered cards for steps                | New ask, a draft mailing, Import sign-ups, Erase |
| `board`      | Cards or tiles of a kind, side by side                     | the head                                       | an `even` grid                                                           | the dashboard, Scheduled jobs, Your account      |

A draft mailing or broadcast is at its record's address, so its page says
`record`, and is laid out as a form until it's sent.

**The head** (`ui/PageHead`) starts every page but a record's, with the
same places on each, so a title is where the last page's was:

- the title, with tags beside it for how the page's thing stands;
- under it in grey, what the page is, in a line or two with no full stop,
  which can say where what it shows comes from, with a link there;
- on an item's page, its facts in one line, each after a dot;
- at the right, the page's buttons (below, "Where buttons that add go").

Every page the navigation leads to says what it is under its title. A
strip for the whole page goes under the head, never over it. The space
under the head is the head's own, the same on every page.

A record's page starts with the band instead (below, "The band"). No
other component writes an `<h1>`.

**The trail** (`ui/Breadcrumb`). A page the navigation doesn't lead to
starts with the trail to it, above its head or band: "Supporters › Jane
Smith › Erase". Its first step is the navigation's own name for the page
it's under, the one the sidebar marks, so the two agree. Then come the
pages it's reached through, each a link, and last the page itself, which
isn't one. The page says these to `ui/Page` (`under`, `via`, `here`),
which draws the trail.

`tests/checks/staff-page-kinds.test.ts` fails on a page that doesn't say
its kind, on a trail that's missing or disagrees with the sidebar, and on
an `<h1>` outside the two heads.

**Where buttons that add go.** Where a button sits says what it adds
to, so there are four places, one for each kind of adding:

- **A new thing of the page's kind: at the top right** (`ui/PageHead`).
  A page where people make new things of its kind (Mailings, Asks) has
  one button for it, at the right of the page's title. It's the first
  thing seen, and it stays in the same place however long the list under
  it grows. It's the page's one primary button. Its words are the title
  of the page it starts, "New mailing" or "New ask", so the button and
  the page it leads to say the same thing. It has no "+": "New" already
  says it.
- **More to what a list shows: in the filter bar.** "+ Filter" ends the
  row of chips, and what it adds is a chip among them (`ui/FilterBar`).
- **A part of the thing being written: in the section it belongs to.**
  "Add files" is in the attachments' box, where the files then show. The
  letter's "+ Only for those who…" is beside the letter, next to the
  fields, which are the other things put into a letter.
- **A row of a short table kept in place: the page's main button, its
  form in a bubble.** On Staff accounts, Add staff is at the title's right
  and opens a field for the address. Type the address and press Add, and
  the row is there, with no page to go to.

"+" marks a small control that adds to something already on the screen,
a filter or a part of the letter, never a button that makes a new thing.

Buttons that act on what a list's filters found ("Mail these 42…",
Download) aren't adding. They sit over the table, in the list frame's
count row. A page whose list isn't a table has Download (`ui/DownloadMenu`, the
same button) beside its title's button instead.

**Choosing something for another part of the pages.** Sometimes one
part needs a set of things chosen with another part's full tools: who a
mailing goes to is chosen with the politicians list's tabs, search and
filters. It doesn't get a lighter copy of those tools. The person is sent
to the list itself, in a choosing mode, and comes back with what they
chose.

The mode is in the address (a draft's ID, `mailing=12`, on the politicians
list), so the tabs, filters and pages all keep it. Each row has a tick
box, and a tick is saved as it's clicked. The box over the rows ticks
everyone the filters find, on every page. A last tab shows only those
ticked. What's ticked is what's chosen, never what the filters find, so
the person can search for one, tick them, and search for the next.

Apart from the tick boxes and that tab, the page is as it always is, with
two bars added:

- **At the top, held there as the page scrolls** (`ChoosingHead`): a dark
  strip, like the bar at the foot. It says what's being chosen and what
  for (a new mailing, or the draft by its title), with a line on how. For
  a new mailing it has the way out at its right: Cancel, which deletes the
  mailing. Only the strip is held, not the title under it. The strip sits
  inside a plain box around the whole page, because the router scrolls a
  new page's first element into view, and if that element were the held
  strip the page would be left scrolled.
- **At the foot of the window, held there** (`ChoosingBar`): a dark bar.
  It says how many are ticked, and has light buttons to see them and to
  untick everyone, and Paste names, whose box opens above the bar. At its
  right is the orange button on to what they're for ("Write to these 5").
  Ticks are saved as they're made. So this button is also the way back
  into a draft, and it shows even when no one is ticked. For a new
  mailing, it's greyed until someone is ticked.

While the list is choosing, the page's own button for the same thing (New
mailing, or Mail these) is hidden, so there's one way on. The person
chooses with tools they already know. The top always says what they're
doing and how to stop, and the foot always shows the result and the way
on, however far they've scrolled.

The supporters list chooses who a broadcast goes to with the same two
bars, but with no ticks. There the filters say who, and the button at the
foot keeps the filters for the draft (`ChoosingBroadcastFrame` in
`_components/BroadcastSupporters.tsx`). A new choosing mode uses these two
bars too, not a design of its own. The mailing's bars are in
`_components/PoliticiansList.tsx`, and the broadcast's bars share its
stylesheet.

**The grid** (`ui/Grid`). The grid has six columns when it's at least
1,000px wide, and two below that. Everything boxed is an item of a grid
and says how much of the row it takes: a sixth, a third, a half,
two-thirds or all (`span` 1, 2, 3, 4 or 6). On two columns, a sixth takes
one column and anything wider takes the row. So a phone shows the
dashboard's tiles two to a row, and cards one to a row.

Items are as tall as what's in them. A grid of things of one kind side by
side (the dashboard's tiles, the import jobs) is `even`: each item is as
tall as its row.

On a page laid out on the grid, the content is never wider than 88rem, so
the columns don't stretch on a big monitor. A new page is laid out on the
grid, and its sections are cards the full six columns wide, even a section
that's a short table. The exception is a list whose table needs the room,
because it has many columns with filters over them (the supporters, the
politicians). That list takes the whole width, and its filters are as wide
as its table.

**Widths.** A component never sets its own `max-width` or `width`: the
grid gives a box its width, and anything read line by line (a form, a
short list) takes the measure, `var(--staff-measure)`.
`tests/checks/staff-widths.test.ts` fails on any other `max-width`, but
for the few it lists with their reasons (a popover, the login page's card,
a field).

**Surfaces.** Each one means one thing:

| Surface                        | Look                                                       | For                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The page                       | the background, no box                                     | headings, prose, the history, tables                                                                                                 |
| A record (`Card`, the default) | white                                                      | the thing a page is about, or a thing to open: an MP's or a supporter's facts, an import job                                         |
| An aside (`Card look="aside"`) | the second tint, `--surface-2`                             | what sits beside a record: an MP's campaigns, a supporter's mailing lists                                                            |
| A log (`Card look="log"`)      | the palest of the accent: `--accent-light` at 30% on white | a history, each entry ruled from the next                                                                                            |
| A tile                         | white, bordered, an item of an `even` grid                 | sets of like things: the dashboard's numbers                                                                                         |
| A strip (`ui/Strip`)           | the tone's tint, no border, `--radius-md`                  | how something stands: green done or signed, amber waiting, red broken, blue going on now, plain neither; dark, a mode the page is in |

Every card has the same edge, a `1px` `--border` and `--radius-lg`. Only
its fill changes, and only among the three card looks in the table, all
warm. Colour stays for meaning: orange for what you can press, the status
colours for state.

**The band** (`ui/Band`). A record whose page is about it alone (a
supporter, a mailing) starts with a tinted band. The band has:

- the record's title and a tag;
- its facts (`BandFact`), each with a quiet line under it;
- at the facts' right, its numbers in one white box (`ui/Counts`). Each
  number is a link (`StaffLink`, below) to what it counts.

When the list under the band is the record's own, as a mailing's
recipients are, each count is a filter that toggles. Pressed, it shows
only those it counts, and is underlined. While it's on, its tooltip is
"Show everyone", and pressing it again shows everyone.

A list of such records (the mailings) has the same white box, small, in
each row, and the whole box leads to the record.

**The dashboard's numbers** (`METRIC_LINKS`). A tile leads to a page that
shows the same number: a tile saying 12 opens a list of 12. So a tile
counts what its list has a row for, with a person or a politician counted
once, and its link carries the window chosen. For staff whose permissions
don't open that page, the tile isn't a link. A filter added only for a
tile's link is hidden ("Filters", below).

**Progress** (`ui/Progress`). How far something has got is a sentence
over a thin bar: blue while it's going out, green for answers. It goes in
its own card under a band, and is thin in a list's row.

**Status colours.** A status is grey but for four:

- red where it didn't arrive or we can't tell (Not sent, Bounced, Spam
  complaint, Uncertain, every skip);
- amber where we stopped it (Cancelled);
- green for good news, the answer a thing was for (Answered);
- blue for what's going out or about to (Scheduled, Sending).

Sent, Replied, Draft and Waiting are grey, so the four stand out.

A skip or a stop says which kind it is in the tag, as "Status: variant":
"Skipped: left office", "Cancelled: we stopped the mailing".

A second fact about a record is a second tag beside its status, never in
its place. Such a fact is that it was answered or replied to, or that a
supporter asked us to stop after a message arrived. So a bounced letter
that was answered shows Bounced and Answered.

Each kind of record's status tags come from one function, used wherever
the record is shown, so a letter reads the same in a mailing's list as on
its own page (`LetterStatus`).

**A column of cards** (`ui/Grid`'s `Column`). When the asides beside a
record are more than one card, such as a letter's ask over its history,
they stack in a `Column` that takes the rest of the row. The cards in it
have no span.

**No box under or beside a box**, except a card or tile in the same grid.
A card holds strips, rows and fields, never another card. So every
section of a page is a card, with its heading the card's title: a
supporter's events and letters, an error's message, your sessions. A
heading loose on the page is over several cards, never over one section's
content.

**Rows in a card** (`ui/Rows`). A card that lists things has rows, each
ruled from the next:

- the main line, which names the thing and leads to it;
- under it, a quieter second line of what else there is to say;
- at its right, something of the row's own: a button, or how it stands.

What ends the rows lines up down the card. A thing named by its day has
its date first, before the main line, and the dates line up too (the
events in a list by owner). The card's title says what the rows share, and
its action can be how many there are. A politician's asks are laid out the
same way (`AskRow`). Something with more to say than this, or that's
compared down a column, is a table in the card instead (`ListTable`).

**Nothing to show** (`ui/Empty`). That there's nothing is said one way:
the page's own words, in grey, at the size of the text around them, where
the content would start. In a card it's the card's one line. A list keeps
its frame ("Lists", below). It's never a strip, which is for how something
stands, nor small print, nor the page's ordinary text.

**A form in a card.** A form of one step is a card, two-thirds of the
grid, with a card of help beside it, an aside: New ask has its preview
there, and Erase what's erased and what's kept. A form in steps is
numbered cards the full width (`ui/Numbered`). A form that can't be undone
says so in a red strip at the top of its card, over its fields.

**Drawing the eye.** When a page opens on something a person just did or
picked, that one thing pulses once in the accent's tint (`--accent-light`,
or the orange at 40%) and settles. The pulse lasts about a second and a
half, starts just after the page appears, and never repeats. It's a change
of colour, not a movement, so it stays with motion turned off. These do
it:

- the ask a link picked out on an asks list (`AsksList.module.css`), which
  stays tinted;
- the broadcast just sent for approval, on the list of broadcasts
  (`MailingsOverview.module.css`);
- a notice that opens after something happened (`ui/Notice.module.css`),
  which starts lit and fades to plain over eight seconds.

**Strips, not alerts.** A strip does one of these jobs:

- On the page, anything that needs a person is a red or amber strip, with
  its icon at the left and its button at the right. The home page has one
  at its top for each such thing, an MP's page has one at its top when
  their address is blocked, and a form has one for an error after it's
  sent.
- Inside a card, a strip is that thing's state: an import job's newest
  run, a campaign's status, a mailing list's answer. A strip that's an
  answer, not a warning, leaves out the icon (`icon={false}`).
- After something a person did, a strip says how it went: green when it
  worked, amber for a warning, red for an error. The amber and red ones
  have their icon.

A strip on the page itself, not in a card, is spaced from what's above and
below it as the grid's cards are (`StaffPage.module.css`), so a page puts
it there with no margin of its own.

**Tables** (`components/ui/Table`). A table is white with every other row
tinted (`--table-stripe`), so the eye keeps to a row across. A cell's
content sits at the cell's top, so the lines of text in a row start level,
however many lines each cell wraps to.

A table whose rows hold buttons, checkboxes or fields is `align="middle"`
(the accounts table, your sessions). A control is taller than a line of
text. With everything at the top, the text beside a button would sit
higher than the button's label, and the row would look uneven. Centred,
the text lines up with the control's middle.

**Lists** (`ui/ListFrame`). Every list is one frame, so no list designs
its own table. A list says its columns once, as data (`ListColumn`): for
each, the heading, the cell, and the value in a download. The frame draws:

- Over the table, ruled off from it, a row for the count and Download. At
  the left it says how many there are, "250 politicians", and which of
  them this page shows, "· showing 101–200". At the right is Download. Its
  menu has CSV and JSON of every page the filters find, and vCard for a
  list of people. In a vCard file each name starts "PauseAI <code> - ",
  with one code for the whole file, so a download's contacts can be found
  on a phone.
- The striped table. A short column (a house, a date, a count) never
  wraps, so the long columns take the room. The frame is as wide as the
  page's column, even past the 88rem that a page laid out on the grid
  keeps to, so a list wraps less on a big screen.
- A table too wide for its window scrolls sideways, on a laptop as on a
  phone. No column is hidden or moved under another to make it fit. Three
  things keep it readable while it does:
  - A column of words says so (`words`), and keeps room for a few of them
    on a line: a `"name"` (a person's, a place's) two or three, a `"line"`
    (a subject, a title, a sentence) four or five. Without it the browser
    squeezes every wrapping column to its longest word before the table
    scrolls, and a name stands four lines tall.
  - A date never breaks across lines, nor a time with it. A column of
    dates is a short one. A date beside or under other words in a cell is
    a `When` (`ui/When`). The storyboard fails on a date on two lines
    (`docs/testing.md`, "The storyboard").
  - A row's buttons (an `end` column) stay at the window's right edge
    while the table scrolls under them, except on a phone, where they'd
    cover too much of the row.
- Words too long for a row are cut short, with "…" in a small pill after
  them that unfolds the whole in their place (`ui/Shortened`): a bounce's
  reason to its first sentence, a sent email's subject at a word. Not
  words that are the way to the row's page, nor a column whose whole text
  is its point.
- Under the table, when there's more than one page, the paging: "101–200
  of 250", then Previous, the page numbers (the first and last pages and
  two either side of this one) and Next. On a phone, "Page 6 of 50" takes
  the place of the numbers.
- A list with nothing in it keeps its frame, so a page doesn't change
  shape when its filters find no one: the count, "0 supporters", the
  headings, and under them one row with the list's words for it in grey.
  When a search or a filter emptied it, the row has Clear filters too,
  which leads where the filter bar's does (`clearedPath`). There are no
  buttons over it, as there's nothing to act on or download.

A downloaded file is named for the list, its filters and the time, in
lower case with underscores:
`politicians_party_labour_2026_10_27_1430.csv`. Downloads of supporters,
their letters and their blocked addresses go in the audit log.

A table that isn't a whole list, inside a card, is a `ListTable`, or a
plain `Table`. It is striped, with no count or downloads.

Columns go in the same order in every list: who it is, then how it
stands, then counts, then when. Some things move from that order:

- The times that date a status, such as when a letter was sent and when
  it was replied to, can sit beside the status instead, to be read with
  it.
- What we add of our own to a record from elsewhere (our process, not the
  thing itself) comes after what the record says. An event's owner and
  doc come after Luma's name, place, tags and who's going.
- What a row's Edit changes goes last, just before Edit, so it sits by
  the button that changes it: an event's owner and doc, or an account's
  permissions.

What the first column is depends on the row:

- Where a row has a page of its own, the first column leads to it, so
  there's one place to click to open it: a supporter's or politician's
  name.
- A row with no name, such as a letter, starts with its status, then a
  link to it ("Letter →"), and then who it's from and to.
- A list read by time starts with when instead. A log is read newest
  first, and the time is all that identifies a row: the audit log, an
  import's runs, a history.
- Something that happens on a day, such as an event, is named by its date
  as much as by its name. So its date comes first and its name straight
  after, still leading to its page: when, what, where, then the rest as
  usual.

If people say the date when they mean the thing, the date goes first;
otherwise it goes last.

**Filters** (`ui/FilterBar`). Every list's filters are the same bar
above it, and a list's own filters component only says what its filters
are:

- The search box comes first, its button, Search, beside it. Until
  something's typed, the box says what it searches ("Name, email or
  phone"), which is its accessible name too. A search waits for the button,
  or Enter, so the list doesn't change while someone types. While there's a
  search, an × in the box empties it.
- Only the filters that are on are shown, each as a chip with the
  filter's name and its choice: "Party: Labour". A filter is on when it
  isn't at its default, so a glance at the chips says what the list is
  filtered by. A chip opens a menu with its choices, in one column that
  scrolls when it's long, and Remove.
- "+ Filter" lists every other filter, a row each. A row opens its choices
  under it, one row at a time, and a choice applies at once. A filter has
  the name of the column it filters, and the filters come in the columns'
  order. Not every column gets a filter, only those someone will filter
  by. A filter with no column of its own goes beside the column it's
  about: Near and MP by Place, Event by Luma events.
- A filter that only a dashboard tile needs, and that isn't useful on its
  own, is hidden as a rule (`linkedOnly`). It isn't in "+ Filter", and
  it's on only when the tile's link turns it on. Then it's a chip like any
  other.
- A filter that makes sense more than once (`repeat`: a party, a nation,
  an event) can be chosen again. It finds what has any of its choices,
  whereas different filters must all match. All it finds are on one chip,
  "Party: Labour or Green", with the "or" lighter. Its menu
  (`ui/ManyChoices`) works like this:
  - It has a row for each choice. A click on a row swaps to that choice
    alone, and the menu closes.
  - "+ Add", in the menu's foot, turns the rows into tick boxes, with the
    filter's choices ticked. "Just one" then takes its place, and turns
    the boxes back into rows, keeping only the first choice ticked.
  - Each tick changes the list at once, and the menu stays open. A tick
    replaces the URL, so Back isn't full of them, and the newest tick
    wins.
  - Clicking away or pressing Escape just closes the menu.
  - With several chosen, the menu opens as boxes, so a click on a row
    can't clear them.
  - Unticking everything takes the filter off the list at once. Its chip
    goes when the menu closes.
  - While someone is ticking, `ui/FilterBarLines` holds the bar as it is.

  A filter that doesn't repeat has no "+ Add". A choice in two parts
  doesn't repeat.

- A filter that repeats can also leave choices out. "+ Filter" is then cut
  in two, "+ Filter | Except", and Except lists the filters that repeat,
  to choose something to leave out. All the choices a filter leaves out
  are on a chip of their own among the others. That chip is white with a
  dashed edge and a struck-through circle, and its words say "not":
  "Party: not Labour or Green". The list then shows what has none of the
  choices left out and any of the choices found. Each chip's menu has,
  beside Remove, a link that turns all the chip's choices the other way:
  "Except this" or "Only this", and "Except these" or "Only these" for
  several. Leaving out every choice removes the filter. In the URL, a
  choice left out is the same parameter with its value marked `!`:
  `event=!evt-2`.
- Where a record has only one value of a filter (`oneEach`: a nation, a
  party, who did it), finding one value already leaves the others out. So
  such a filter only ever has one chip: adding a choice to find drops the
  choices left out, and adding a choice to leave out drops the choices
  found. A filter from an old link or a saved filter that has both kinds
  shows both chips until it changes. Where a record can have several
  values (a tag, an event), the filter keeps both chips.
- Politicians, Supporters, Events and the audit log have saved filters
  (`ui/SavedFilters`, FilterBar's `saved`, and "Saved filters" in
  `docs/domain-concepts.md`):
  - Where it sits: the saved filters are a white lozenge at the right of
    the bar's first row. On a phone the lozenge shares a row with the
    search, which takes the room the lozenge leaves, or, where it doesn't
    fit, has its own row under the search. If the search, the chips and
    the lozenge don't all fit on one line, the chips start a line of their
    own (`ui/FilterBarLines`).
  - Its first half: the bookmark is outlined, or filled in the accent when
    a saved filter is loaded. With one loaded, the lozenge is named for
    it. A long name is cut at about 17rem, with the full name on hover.
    "edited" comes after the name and is never cut.
  - Its second half is there only when there's something to save. With a
    filter or search on and no saved filter loaded, it's Save, which opens
    a small form with the name filled in. Once a loaded one has been
    edited, it's Save ▾, a menu with Update for all, Save as new and Undo
    my changes.
  - The list of saved filters has a box that narrows it by name. Each row
    has a saved filter's name, summary, creator and date, and is a link
    that loads it. Each row also has a menu to rename or delete the saved
    filter without loading it.
  - Clear filters unloads a saved filter too. A loaded one that names
    something gone says so under the bar.
- A filter with too many choices to read (`searchable`: the events) has a
  search box over its choices, and shows none of them until something's
  typed.
- A place filter (`place`: Near) is a small form for a place in words and
  how far from it. Its chip says what it found: "Near: Leeds, 10 miles".
- A filter can come after another (`after`). Once the first filter is on,
  the two are one chip in two halves, and each half opens its own choices.
  The second filter goes when the first does. An ask's chip is "Edinburgh
  conference | Declined", with "Any answer" in the second half until an
  answer is chosen. When the second filter is on without the first, as it
  can be from a link, it's an ordinary chip: "Answer: Signed".
- When the filter that comes `after` another repeats, as an ask's answers
  do, the menu of the chip's second half has "+ Add": "Edinburgh
  conference | Going or Declined". Ticking nothing means its blank choice,
  "Any answer". Changing the first half clears the second. A filter like
  this can't leave choices out.
- A filter can have choices in two parts (an option's `seconds`). Its chip
  is then in two halves: the first half chooses among the choices, and the
  second among the second parts of the one chosen. Such a filter doesn't
  repeat. A choice list can have headings (an option's `group`, its icon
  once) and a quiet `detail` after a choice. The Consent filter does all
  of this. Its topics come under Email and Phone. A topic, when chosen,
  finds those we can contact about it, "Consent: PauseAI UK | Can email",
  and the chip's second half turns that to Not sure or Can't email. The
  first half changes the topic, or removes the filter. Its value is one
  parameter: `contact=email:newsletter:yes`.
- A filter that matters most has its own button (`own`) before
  "+ Filter", and "+ Filter" doesn't offer it. Once it's on, its chip
  comes first. The supporters list's Consent is one, as it's what a
  broadcast needs.
- A filter that can't change in a mode is `locked`, and says why on hover.
  Its chip is there, with a padlock in place of its arrow, but doesn't
  open. "+ Filter" doesn't offer it, and Clear filters keeps it. Consent
  is locked while the list is choosing who a broadcast goes to, because
  the broadcast's writer is where it changes.
- Clear filters comes last, and shows while anything is on. It empties the
  search, every filter and the sort. A tab over the list, such as the
  politicians' houses, isn't a filter, so Clear filters keeps it.
- Every choice is a link, so the URL holds the filters. A new filter
  starts from the first page. A chip's menu is a popover (`ui/Menu`).

**Tabs** (`ui/Tabs`). Tabs are views of one list, side by side over it,
with the chosen one underlined: the politicians' houses. A list has at
most one row of tabs, for the one choice people make most.

**Popovers, not modals.** Anything a button opens (a menu, a small form,
or the few words behind a "?") is a bubble hung from that button
(`ui/Bubble`, or `ui/Menu` for a list of choices). So it opens where the
person is looking, and the page stays in view around it. It's never a box
in the middle of the window, which takes people away from what they were
doing and hides what they'd want to check against. The one exception is a
browser too old to anchor a bubble, which shows it in the middle as a
fallback. A choice that needs confirming is confirmed in place, as Delete
draft is pressed twice.

**A row of a table is edited in a bubble.** A row's Edit opens its form
in a bubble hung from the button, over the table, with Save and Cancel
(the events' owner and doc, an account's permissions). The row never
turns into its form: the cells would change size, and the whole table
would jump. A row holds no field of its own either, as a field takes a
column's width from the words: a blocked address's "Unblock…" opens a
bubble that asks why, with Unblock and Cancel.

**A bubble you click open to work in or read has a pointer up to its
button** (`ui/Bubble`). A bubble that holds a form, or a few words on the
thing beside it, is a small dialog: an Edit, Add staff, Change the time, a
"?", a {}. Its pointer says what it belongs to, which matters most where
the same button is down every row, as {} is down a history. The pointer
points to its button's middle at any width, on a phone too, while the
bubble is kept inside the window's margins.

Two things have no pointer. One is anything that is a control opened out
(`ui/Menu`): a dropdown of choices, or a date picker's calendar, which is
the field's own and not something about the thing beside it. The other is
a tooltip that comes and goes with the mouse.

On staff pages that's the rule. On the public pages, which each have their
own look, it's only a guide.

**JSON from the database is shown in words** (`Logged.tsx`). A column of
details stored as JSON, as the audit log's details and a letter's history
are, is never shown raw. Each field gets its label in bold from the copy,
then its value in words: a status by its name, a date as a date, someone
linked to their page. The fields go between middle dots (`DotParts`). A
field with no label in the copy shows its key as stored, so nothing
logged is hidden.

Beside the words, a {} button (`LoggedJson`) opens the JSON exactly as
stored, in a bubble by the button. That's the fallback, for checking
exactly what was recorded, or for a field the words don't cover yet.

**A history** (`LetterHistory`). A history is a letter's events, newest
first, each with its fields in words and a {} for what it recorded. Every
email in it says who it went to, and its tag says what sent it or brought
it in, Postmark or Gmail. The tag is what the email's event recorded or,
for an event recorded before events kept that, what the letter went by. A
Sent with no event of its own comes from the letter's dates.

An entry that belongs to another goes under it, a size smaller:

- A reply's relay goes under the reply: every entry naming the reply's
  message in Gmail (relayed, waiting, held, bounced, uncertain, not
  relayed, and the MP's office told it can't be passed on).
- The supporter's copy (sent, held, bounced, delayed) goes under Sent: the
  last Sent before the copy, or the first Sent if the copy was recorded a
  moment earlier.
- A notice to the supporter goes under what it tells of. A notice that the
  letter bounced goes under the last bounce before it, and a notice that
  it went again goes under the last Sent. When that bounce or sending
  again was a relay's, it is under its reply, so the notice goes there
  too, beside it.

Anything else stays in the list, in its place. So does a notice with
nothing before it to go under.

**A job's log** (`RunList.tsx`). A job's runs go under a heading for each
day, newest first. How a day's runs are laid out depends on how often the
job runs.

A nightly job shows each run whole, in its box (`RunBox`). The
newest is tinted by how it ended.

A job that runs every 5 minutes or hourly has one table a day instead
(`RunTable.tsx`, `lib/run-log.ts`), so the same number sits in the same
place. The time comes first, then the job's counts, or what each run
found. A Gmail read's counts are over every account it read. In the
table:

- A routine run is a row of counts.
- A stretch of runs that found nothing is one muted row, with its time
  range in the time column.
- Anything shown whole is a row of its own words, with its detail folded.
  It has no box, and leaves out the time and the schedule, which the row
  and the page already say.
- A run with both counts and words has its counts in their columns and its
  words in a row under them, with no rule between the two rows.
- The newest run's rows are tinted by how it ended. A problem's rows stay
  tinted further down.
- Rows too far down fold into a line between the day's tables. The line
  opens into more of the table, without a header. The first table shown
  for the day has the header.

The table keeps a width for its counts, and scrolls sideways on a phone
(`ui/Table`, fixed layout).

**The sidebar** (`StaffNav`). Each page has its icon (`NavIcon`) beside
its name. On wider screens, a round button at the top of the sidebar's
edge (`ui/NavFold`) folds the sidebar to a rail of the icons. On the rail,
a short rule stands for each section's heading, and a page's name shows
beside its icon on hover or focus. The browser remembers whether the
sidebar is folded (`lib/staff-nav.ts`).

**A thing's name leads to it.** Wherever the name of something with a page
of its own is shown, such as a campaign, an ask or a politician, the name
links to that page. So a thing that looks the same goes to the same place.
These go with that rule:

- A number can go elsewhere, to a filter or a list of what it counts.
- A link to somewhere else has words of its own ("See it", not the name).
- A letter or email with no name of its own is opened by "Letter →",
  everywhere. Its status stays plain words beside the link, so a status
  never looks like a link. A politician's answer in their history is plain
  too.
- A one-off thread has its subject as its name, so the subject is what
  opens it. The exception is Correspondence, where the thread is among letters
  and is opened as they are, by "Thread →".

There are two exceptions to the rule. A name in a choice, such as a menu's
option, picks the choice instead. And for staff who can't open the page,
the name is plain.

**What a permission hides** (`ui/Withheld`). Words standing in for
something a staff member's permissions keep from them must go in
`Withheld`, which shows a sealed envelope and muted italics, so it looks
the same everywhere. Examples are a thread they can't read, and a line of
a politician's history with no sender. `Withheld` is never a link, as
there's nothing to open. Something simply left out, such as a missing
column or a number that isn't linked, needs no words and no `Withheld`.
When a list leaves rows out, one `Withheld` line over the list says what
isn't shown and why: sent emails and the audit log do this for an admin
without `supporters`.

**Columns the filters fix** are left out, as in the politicians table: the
house column under a house tab, the party column with one party found, the
status column with one status. It's the filters that decide, never the
rows on the page, which may agree by chance. A choice that's left out
fixes nothing.

The gallery's staff groups show each piece and each page built from them.

## Borders and shadows

Corners are the `--radius-*` tokens (above): buttons and fields
`--radius-md`, cards `--radius-lg`, tags `--radius-pill`, avatars `50%`,
images in cards none (full bleed).

Cards have a `1px solid var(--border)` border. There are no heavy or
coloured borders, except for active and focus states and the feature
card's accent edge.

A box that shows a state says so with its tint. The background is the
status colour's `-bg` token (`--status-red-bg`, `--status-amber-bg`,
`--status-green-bg`), and the words can take the status colour. On staff
pages that box is a strip, with no border (above, "Staff pages"), while a
past run in a job's history keeps the ordinary border. Never a thick edge
on one side: on a rounded corner it bends into a wedge.

Only the current state is coloured. A history of past runs or events is
plain, so the one thing in colour is the thing that's true now. The
exception is a job that runs every 5 minutes: among hundreds of runs a
failure or refusal would be lost, so it stays tinted (above, "A job's
log").

Shadows are warm-toned (brown-black, not blue-black), from the two shadow
tokens:

| Level    | Value                             | Usage                           |
| -------- | --------------------------------- | ------------------------------- |
| Subtle   | `0 1px 3px var(--shadow)`         | Default cards                   |
| Medium   | `0 4px 16px var(--shadow)`        | Hovered cards                   |
| Elevated | `0 8px 32px var(--shadow-strong)` | A hero image, the cookie banner |

## Buttons

Every button is `Button`, `ButtonLink` or `ButtonAnchor`
(`components/ui/Button.tsx`), `IconButton` for the round ones, or
`LinkButton` for one that reads as a link (Remove, Undo). Nothing else
styles a button's look. A container that needs its buttons a different
size sets `--button-padding` and `--button-font-size` on itself. A row of
buttons after what they act on is `Actions`. A row centred under a section
is `ButtonRow`.

### Which button

- **Primary, orange** (`variant="primary"`): the one thing a form or a
  page is for: Save, Schedule, Connect Gmail, New ask. One to an area,
  so it's plain what to press.
- **Secondary, no colour** (`variant="ghost"`): anything else beside it:
  Change the time, Disconnect Gmail, a row's Edit, and the first press of
  Delete.
- **Danger, red** (`variant="danger"`): only the press that destroys
  something for good, the second press of Delete.
- **Size.** A form's own buttons are the default size; a secondary one
  beside its primary, such as Delete beside Save, is `small`. Buttons in
  a table's row, a strip or a bar of filters are `small` too.
- **A link, not a button,** for going to read or look at something,
  where nothing changes and it isn't what the page is for: a row's name,
  to its own page; a count, to the list it counts; back to the list; a
  section of the page. Anything that does something, or opens a form to
  do it, is a button, even when it goes to another page. So Edit and New
  ask look like buttons, not links (`ButtonLink`; in the staff pages a
  `StaffLink` with `buttonClass`, below). `LinkButton` is the one
  exception: a button that reads as a link, for a small step in a line of
  text that's easily undone (Remove, Undo).

### Buttons that wait

A button whose work waits on a server, another site or a big file made
in the browser shows it's working from the moment it's pressed until
its work is done or the next page comes. It greys at once, as a disabled
button does, and can't be pressed again. If its work takes more than a
moment (0.3s), a spinner takes the place of its words, which keep their
room, so the button stays the same size. The cursor stays as it was. A
quick one only greys for a moment, and a button whose work is instant,
such as one that opens a menu, doesn't wait at all.

- **A form's submit button** is `SubmitButton`. It's pending while a
  Server Action runs, and for a form that posts to a URL (logging in or
  out), until the next page comes.
- **A menu's item that sends a form** is `MenuSubmit` (`ui/MenuSubmit`), with
  the same grey and spinner. The menu stays up until the form's work is done.
- **A button that does its work itself** (`onClick`) gives `Button` its
  `pending`, from its press until the work's done: Send test, Schedule,
  a download.
- **A button that leaves the page**, to another site (Google, Stripe) or
  through a full page load after saving (Change who), is pending from
  `useLeaving`. It stays pending until the next page comes, and is
  itself again if the browser's Back brings the page back. A link that
  does this is a `ButtonAnchor` with `pending`.
- **Links in the staff pages**, including the ones that look like
  buttons, show the thin line along the top of the page instead
  (`StaffLink`, and `data-pending` on anything else that waits for a
  page, such as Log out in the navigation). Nothing spins. ESLint
  refuses `next/link` in the staff pages, and a plain `<a>` with
  `buttonClass` there (`STAFF_LINK_IMPORT` and `STAFF_BUTTON_LINK_RULES`
  in `eslint.config.mjs`).

A button with a look of its own (the donate page's) puts its words in
`ButtonInside` and greys itself while `aria-busy`.

### Deleting, pressed twice

Delete is a ghost button naming what it deletes ("Delete ask"). Pressed
once, it turns into a red "Press again to delete it" ("Confirm?" where
there's little room), which takes the focus; pressed again, it deletes.
It goes back to how it was after a few seconds, or as soon as the focus
leaves it, so a stray click deletes nothing (`DeleteTwice`). There's no
dialog. While it deletes it stays red, with its spinner, as every button
does while its work goes on.

That's the standard way to delete one thing whose deleting has no
consequence beyond its being gone: a draft, an ask nobody has answered,
a politician gone from Airtable whom nobody has written to.

Deleting that goes further is a page of its own, as erasing a supporter
is (`EraseForm`). The page says what will go. It has a box to tick before
the red button does anything, and a field for why, such as the request's
reference, which is kept in the audit log. Any feature that deletes a lot
at once, or deletes what other records depend on, works that way.

Delete is offered only when the thing can be deleted. While something
refers to it (an ask politicians have answered, a mailing that's been
sent), there's no button, and a `Hint` says why in its place.

### How they look

Every button is `14px 24px` of padding (`--button-padding`), `8px`
corners, and Inter at `15px` (`--button-font-size`), weight 600.

- **Primary**: `var(--accent)`, solid, white text, a soft orange shadow;
  on hover a stronger shadow and a lift of a pixel.
- **Ghost**: transparent, a `1px` `var(--border-strong)` border and
  `var(--text)`; on hover the border and text turn `var(--accent)`.
- **Light** (on a photo): `var(--white)` with `var(--ink)` text and an
  orange border; on hover an orange ring.
- **Danger**: `var(--danger)`, solid, white text; on hover a dark ring.

Sizes: `small` and `large` besides the default.

## Cards

The site's cards are `PhotoCard` (an image above a body) and `FeatureCard`
in `components/ui/`; areas have their own built on the same look
(`PersonCard`, the local groups' cards).

- **Photo card** (an activity, a local group): white, the card border,
  `12px` corners and the subtle shadow; the image full width at `3:2`,
  clipped to the corners; `20px` of padding round the text; on hover the
  medium shadow and a lift of two pixels.
- **Feature card** (the mission's pillars): the same box with a `3px`
  `var(--accent)` left edge, and `--space-5` of padding.
- **Person card**: a round photo beside the text, with no heavy border.

## Header and navigation

`Nav` (`components/layout/Nav.tsx`) is sticky and black, with light text
(`--on-dark`), and no heavy chrome. At 1024px and below a burger opens the
menu over the page.

## Sections

A page is a run of `Section` bands (`components/ui/Section.tsx`), and a
band's `tone` prop picks its background. A page's top is `PageHero`, and
an introduction under it is `Foreword`.

- **Default**: `var(--bg)`, warm cream, with `80px` above and below, less
  on a phone.
- **Muted** (`tone="muted"`): `var(--surface-2)`, a slightly darker cream,
  solid, for a clean break between sections.
- **White** (`tone="white"`): `var(--accent-bg)`.

Words with an action beside them (a button, a photo) inside a section are
`Callout`.

## The briefings and the march

Two parts of the site have a look of their own. How their styles are
organised is in `docs/code-structure.md` ("The weekly briefings", "The
march sign-up").

- **The weekly briefings** (`/campaigns/briefings`) follow their
  designer's A4 layout: a white sheet on the page, a masthead (logo,
  byline, the week's calendar, title, an orange rule), then boxes ruled in
  a topic's colour with the heading on a tab, and charts of their own. The
  sizes are the design's, scaled so the text is 16px, and the topic
  colours are the `--briefing-*` tokens.
- **The march sign-up** (`/protests/march-against-ai-extinction-nov-26`)
  is a poster, deliberately unlike the rest of the site: ink and paper, a
  hotter orange (the `--march-*` tokens), Anton for headings, square
  corners and hard shadows, with a header of its own and the site's
  footer.

## Links

- Default: `var(--accent)` (`styles/base.css`)
- A link set in text that should stand out: `.inline-link`, bold, underlined on hover
- Footer links: light on the dark footer
- A link out of the site opens in a new tab and sends no referrer:
  `target="_blank" rel="noreferrer"`. On public pages it has no icon or
  other mark. On staff pages it's `ui/ExternalLink`, with an arrow after its
  words (↗), as "→" marks a link within the staff pages. `ExternalLink` is
  for a link to another site. It isn't for a file of our own, or for a
  link inside a letter's preview, which shows the letter as it's sent.
  Links within the site, `mailto:` and `#anchor` links open in place.

## Interface text

- **Sentence case** for labels, buttons and headings: "Your name", "Find my MP", "Send email". Not "Your Name" or "Find My MP". Proper nouns keep their capitals: "MP", "PauseAI", "Airtable".
- **Full stops** on messages that are sentences: errors, notices, hints and confirmations. "Please enter your name.", "Postcode not found."
- **No full stops** on labels, buttons, headings, or a word or two of status: "Your email", "Preview", "Sending".
- **Dates as people say them**: "23 Oct 2026", and with a time, "23 Oct 2026, 10:34", never "2026-10-23". The staff pages' dates are in UTC (`staffDate` and `staffTime` in `lib/staff-time.ts`). A download keeps the ISO form, for a spreadsheet to read.

## Imagery

- Photography is documentary, not stock: real people at real events.
- Warm colour grading, slightly desaturated and amber-shifted.
- Hopeful and energetic, not grim.
- Hero images carry a subtle warm gradient overlay.

## Phones and wide screens

- The container is `1140px` at most, with `24px` of side padding.
- Most components change at `720px` or `860px` (and `520px` for the
  smallest phones); the nav switches to its burger at `1024px`.
- Headings scale with `clamp()`, not by breakpoint; spacing drops by whole
  steps on a phone ("Using the spacing", above).
- Check both: the storyboard pictures every page, and the gallery every
  component, on desktop and a phone.
