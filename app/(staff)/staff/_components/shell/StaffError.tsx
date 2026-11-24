"use client";

import { Button } from "@/components/ui/Button";
import type { ErrorPageProps } from "@/components/layout/ErrorMain";
import { useErrorTold } from "@/components/layout/useErrorTold";
import type { reportBrowserError } from "@/lib/browser-errors";
import Alert from "../ui/Alert";
import Page from "../ui/Page";
import PageHead from "../ui/PageHead";
import { shellCopy } from "./copy";

/**
 * What a staff page says in place of itself when it throws, or a Server
 * Action it called does (the signed-in pages' error.tsx): that it went
 * wrong, and a button that loads it again, beside the navigation, which
 * stays. One the browser threw is told to the site first (useErrorTold);
 * the server has kept its own.
 */
export default function StaffError({ error, retry, report }: ErrorPageProps & { report?: typeof reportBrowserError }) {
  useErrorTold(error, report);
  const copy = shellCopy.error;
  return (
    <Page kind="form">
      <PageHead>{copy.title}</PageHead>
      <Alert>{copy.words}</Alert>
      <Button variant="primary" type="button" onClick={() => retry()}>
        {copy.retry}
      </Button>
    </Page>
  );
}
