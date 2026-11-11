"use client";

import { useState } from "react";
import Actions from "@/components/ui/Actions";
import { Button } from "@/components/ui/Button";
import ProsePage from "@/components/ui/ProsePage";

/** Throws, as a bug in a button's own code would. */
export function breakNow(): never {
  throw new Error("Asked to break, from a click, on try 2");
}

/**
 * A page that breaks in the browser when asked, for the storyboard to show
 * what a visitor sees when one does: one button throws while the
 * page renders, which loses the page to the error page; the other throws
 * from its click, which leaves the page as it was.
 */
export default function Broken({ onBreak = breakNow }: { onBreak?: () => void }) {
  const [broken, setBroken] = useState(false);
  if (broken) throw new Error("Asked to break, while rendering, on try 1");
  return (
    <main>
      <ProsePage>
        <h1>A page that breaks</h1>
        <p>Each button throws an error in the browser, as a bug would. Only a fixture build has this page.</p>
        <Actions>
          <Button variant="primary" onClick={() => setBroken(true)}>
            Break while rendering
          </Button>
          <Button variant="ghost" onClick={onBreak}>
            Break from a click
          </Button>
        </Actions>
      </ProsePage>
    </main>
  );
}
