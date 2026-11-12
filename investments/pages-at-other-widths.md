# Pages pictured at other widths

Size: S. Kind: tools.

## Problem

The storyboard pictures every flow at two widths: 1280px and a phone's. A layout that goes wrong between them or past them is never pictured: a table squeezed at 1440px that's fine at 1680px, a head that wraps at a tablet's width. To see one, an agent writes a Playwright script in `tmp/` that logs in to a served branch, opens a list of pages at a list of widths, pictures each and measures what it's looking for.

## Fix

A command that does it: `npm run widths -- /staff/politicians /staff/sent-emails` pictures those pages of the branch `npm run serve` is serving, in Firefox, at a set of widths from a phone's to a big monitor's, and writes the pictures and one page that shows them side by side to `tmp/`. With `--tables` it also lists each table that runs past its box, each date on two lines and each column whose words wrap to three lines or more.

## Hits

- 2026-11-12: wrote a script in tmp/ to picture 21 staff pages at seven widths and measure their tables, and ran it five times, ~40 min
- 2026-11-12: the march page's hero left its words at the window's edge past 1440px, which neither width pictures; wrote a script in tmp/ to picture it at eight widths and measure where the words sat, ~15 min
