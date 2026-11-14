# Salutations from the titles bodies record

Branch `parliament-full-titles`, in `tmp/worktrees/parliament-full-titles`,
from main after #335 (politicians from their bodies' own lists). One PR.

## Why

Our salutations for politicians already on our list came from Airtable, and
some are wrong. The imports keep ours for anyone we already had, and only
use the rule's for new members (`updated()` in `lib/politician-import.ts`).
Where a body records the member's own title, that's their stated
preference, and should win.

What each body records (checked 14 Nov 2026):

- **Commons:** Parliament's list name carries a title when the MP has one
  on record ("Badenoch, Mrs Kemi"; Dr, Dame, Sir). `mpSalutation` already
  reads it (`lib/salutation.ts`). With none, the rule uses Mr or Ms by gender.
- **NI Assembly:** every MLA has a title in `MemberPrefix` (Mr, Mrs, Ms,
  Miss, Dr), matching its Official Report. Our 18 still-wrong MLA
  salutations (Dr Archibald, 10 Mrs, 7 Miss) are all ones it records.
- **Lords:** the salutation comes from the rank; leave as is.
- **Scottish Parliament, Senedd:** no title anywhere (their lists, sites,
  official reports, TheyWorkForYou or Wikidata). Gender comes from
  Wikidata. Leave as is.

## What to build

1. `OfficialMember` (`lib/politician-import.ts`) gains `titled?: true`:
   the body records their title, so `salutation` is how they asked to be
   addressed. Set it:
   - in `lib/parliament.ts` for a Commons member whose list name has a
     title (export `titled()` from `lib/salutation.ts`, or a helper there);
   - in `lib/ni-assembly.ts` when `MemberPrefix` is given.
2. `OurPolitician` gains `salutationByStaff: boolean`: staff set it by hand
   on the site. In `bodyPoliticians` (`lib/server/politician-import.ts`):
   an `audit_log` `edit politician` entry for them whose `details.changed`
   has `salutation` and whose actor is a staff member (an email, so it
   contains `@`, not an import's job name or `migration`).
3. In `updated()`: for a `titled` member whose salutation differs from
   ours, take theirs (and clear `salutationToCheck`), unless
   `salutationByStaff`. It then shows in the run as a changed field, like
   any other.
4. Wikidata surnames (`withSalutations`, `lib/server/politician-import.ts`
   around `const surname =`): use Wikidata's surname only if their name
   ends with it; else `surnameOf(m.name)`. Wikidata gave "Cooper" for Sarah
   Cooper-Lesadd, MS, so her salutation came out "Ms Cooper".
5. Tests for each, 100% coverage; the storyboard if anything shows
   differently; `docs/domain-concepts.md`'s salutations part says the
   body's recorded title wins over ours unless staff set it.

On the first night after it ships, the NI import should change about 18
salutations (under the 20 that hold a run), and the Commons a few.

## Done already, by hand on production

Fixed: 15 MPs (Mr/Ms swaps, Long Bailey, Sandher-Jones, Dr/Dame/Sir, Lord
Colville), Helen Grant (Mrs, from Hansard), Pat Sheehan and Patsy McGlone
(Mr), Sarah Cooper-Lesadd, Benjamin Hodge McKenna. Sureena Brackenridge
stays Mrs (Hansard uses it; Parliament's list has no title).
