"use client";

import Actions from "@/components/ui/Actions";
import { Button } from "@/components/ui/Button";
import { type ErrorPageProps, useErrorTold } from "@/components/layout/ErrorPage";
import type { reportBrowserError } from "@/lib/browser-errors";
import { staffCopy } from "@/lib/content/staff-interface";

/**
 * What staff see in place of a staff page that threw, inside the page's
 * frame, so the navigation stays: what happened, where it's kept, and a
 * button to try again.
 */
export default function StaffErrorPage({
  error,
  retry,
  report,
}: ErrorPageProps & { report?: typeof reportBrowserError }) {
  useErrorTold(error, report);
  const copy = staffCopy.errorPage;
  return (
    <>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <Actions>
        <Button variant="primary" onClick={retry}>
          {copy.retry}
        </Button>
      </Actions>
    </>
  );
}
