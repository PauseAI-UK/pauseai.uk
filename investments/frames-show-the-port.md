# Frames show the server's port

Size: S. Kind: tools.

## Problem

A link the site writes out in full, such as the contact preferences link in the answer to a WhatsApp STOP, carries the fixture server's origin, and each checkout's server has its own port: the branch's and main's differ. `frame.ts` swaps the origin for `SHOWN_ORIGIN` in an email's view, but not in a text's or on a page. So "Stop, replied in WhatsApp" differs from main's frames in every review, on both viewports, though nothing changed.

## Fix

Swap the origin for `SHOWN_ORIGIN` in what a text's view shows (`tests/fixtures/text-view`), as the email view does; then, for pages, in the frame's text nodes and link targets before the screenshot.

## Hits

- 2026-11-13: four frames of "Stop, replied in WhatsApp" differed from main's by the port alone, and had to be opened to rule out a change, ~5 min
