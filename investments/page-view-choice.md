# Pages that choose a view

Size: S. Kind: small fix.

## Problem

Pages may not branch (the thin-pages check), so the events page picks its title and view through lookup tables, `TITLES[eventView(params)]` and `VIEWS[...]`: a branch in disguise, outside coverage.

## Fix

Let a page choose a view component from a tested parser's result, and say so in the thin-pages rule, or move the choice into a tested component.

## Hits

None yet.
