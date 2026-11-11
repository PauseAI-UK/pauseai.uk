"use client";

import { useEffect } from "react";
import Actions from "@/components/ui/Actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import ProsePage from "@/components/ui/ProsePage";
import { reportBrowserError } from "@/lib/browser-errors";

/** What Next hands an error page: what was thrown, and a way to render the page again. */
export type ErrorPageProps = { error: unknown; retry: () => void };

/**
 * Tells the site of the error an error page caught, if the browser threw it.
 * One the server threw arrives with a `digest` in place of its words, and
 * the server has kept it already (instrumentation.ts).
 */
export function useErrorTold(error: unknown, report = reportBrowserError): void {
  useEffect(() => {
    const fromServer = typeof error === "object" && error !== null && "digest" in error;
    if (!fromServer) report("browser-page", error);
  }, [error, report]);
}

/**
 * What a visitor sees in place of a page that threw, in Next's error.tsx
 * (https://nextjs.org/docs/app/api-reference/file-conventions/error): an
 * apology, a button to try again and the way home. The error.tsx puts it
 * in its <main>.
 */
export default function ErrorPage({ error, retry, report }: ErrorPageProps & { report?: typeof reportBrowserError }) {
  useErrorTold(error, report);
  return (
    <ProsePage>
      <h1>⁂ Something went wrong</h1>
      <p>
        ⁂ Sorry, this page hit a problem, and we&apos;ve been told about it. You could try again now, or come back a
        little later.
      </p>
      <Actions>
        <Button variant="primary" onClick={retry}>
          ⁂ Try again
        </Button>
        <ButtonLink variant="ghost" href="/">
          ⁂ Go to homepage
        </ButtonLink>
      </Actions>
    </ProsePage>
  );
}
