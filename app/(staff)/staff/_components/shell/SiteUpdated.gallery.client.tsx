"use client";

import { Button } from "@/components/ui/Button";
import SiteUpdated from "./SiteUpdated";

/** Where it calls: any page answers a Server Action. */
const PAGE = "/";

/** A Server Action's ID no build has, as a page opened before a deploy calls one. */
const GONE = `40${"0".repeat(40)}`;

/** A button calling a Server Action the site doesn't have, as one does after a deploy, and the dialog that then shows. */
export function SiteUpdatedExample() {
  return (
    <>
      <Button
        variant="primary"
        fit
        onClick={() => void fetch(PAGE, { method: "POST", headers: { "Next-Action": GONE } })}
      >
        Press a button after a deploy
      </Button>
      <SiteUpdated />
    </>
  );
}
