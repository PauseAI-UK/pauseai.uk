"use client";

// Notice's examples that keep state or log what's pressed (Notice.gallery.tsx).
import { Button } from "@/components/ui/Button";
import Notice from "./Notice";
import { useState } from "react";

/** A note, open, that its × closes, and opens again. */
export function NoticeExample() {
  const [open, setOpen] = useState(true);
  return (
    <span role="status">
      {open ? (
        <Notice close="Close" onClose={() => setOpen(false)}>
          Emailed sean@pauseai.uk and joseph@pauseai.uk to let them know sean@pauseai.uk now owns this event.
        </Notice>
      ) : (
        <Button variant="ghost" size="small" fit onClick={() => setOpen(true)}>
          Open it again
        </Button>
      )}
    </span>
  );
}
