# A server's port shown in storyboard frames

Size: S. Kind: small fix.

## Problem

The texts a flow sends link back to the site by its origin, and each checkout serves its storyboard on its own ports. So a frame that shows such a link, as "Stop, replied in WhatsApp" does in its answer to STOP and its copy's page, differs from main's in every review, though the branch changed nothing there. Each review has to look at them and rule them out.

## Fix

Give the links in a fixture build one origin whatever the port, as the email fixtures may already do, or have the storyboard serve every checkout's build under the same host name.

## Hits

- 2026-11-13: four frames of "Stop, replied in WhatsApp" differed from main by the port alone, in two reviews in a row, ~5 min
