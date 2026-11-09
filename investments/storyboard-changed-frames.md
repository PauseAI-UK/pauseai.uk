# The storyboard's changed frames

Size: S. Kind: tools.

## Problem

After a storyboard run, agents need the frames that changed, with their captions and PNG paths, to look at each one. `--paths` prints every frame, so finding the changed ones means reading `storyboard.json` by hand. Agents have also written seven `tmp/review*` scripts to crop and compare frames.

## Fix

`npm run storyboard -- --changed`, or a small script over the latest run, prints only the frames that differ from main, the new ones and the ones that are gone, each with its caption and the paths to both PNGs.

## Hits

- Week of 2026-10-12 (x6): sessions read `storyboard.json` with their own script
- Week of 2026-10-19 (x6): sessions read `storyboard.json` with their own script
- Week of 2026-10-26 (x14): sessions read `storyboard.json` with their own script
- Week of 2026-11-02 (x15): sessions read `storyboard.json` with their own script
