"use client";

import { Button } from "@/components/ui/Button";
import ProsePage from "@/components/ui/ProsePage";
import type { reportBrowserError } from "@/lib/browser-errors";
import { errorPageCopy as copy } from "@/lib/content/error-page";
import { useErrorTold } from "./useErrorTold";

/** What Next hands an error.tsx: what was thrown, and the way to load the page again. */
export type ErrorPageProps = { error: unknown; retry: () => void };

/**
 * What a public page says in place of itself when it throws, between
 * whatever header and footer its layout has (each layout's error.tsx): that
 * it went wrong, and a button that loads it again, after telling the site of
 * an error the browser threw (useErrorTold). The page's <main>, with `id`
 * where a skip link leads to it, or `as="div"` inside another's, as the
 * component gallery shows it.
 */
export default function ErrorMain({
  error,
  retry,
  as: Tag = "main",
  id,
  report,
}: ErrorPageProps & { as?: "main" | "div"; id?: string; report?: typeof reportBrowserError }) {
  useErrorTold(error, report);
  return (
    <Tag id={id}>
      <ProsePage>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <Button variant="primary" type="button" onClick={() => retry()}>
          {copy.retry}
        </Button>
      </ProsePage>
    </Tag>
  );
}
