"use client";

import ErrorPage, { type ErrorPageProps } from "@/components/layout/ErrorPage";

/** In place of a public page that threw, between the site's header and footer. */
export default function SiteError(props: ErrorPageProps) {
  return (
    <main>
      <ErrorPage {...props} />
    </main>
  );
}
