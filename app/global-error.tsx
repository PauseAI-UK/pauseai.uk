"use client";

import "@/styles/tokens.css";
import "@/styles/base.css";
import ErrorPage, { type ErrorPageProps } from "@/components/layout/ErrorPage";

/**
 * In place of the whole document when the root layout itself threw, so it
 * has its own <html> and <body>, and brings the global styles the layout
 * would have
 * (https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error).
 */
export default function GlobalError(props: ErrorPageProps) {
  return (
    <html lang="en">
      <body>
        <main>
          <ErrorPage {...props} />
        </main>
      </body>
    </html>
  );
}
