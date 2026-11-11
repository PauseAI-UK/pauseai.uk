"use client";

import ErrorPage, { type ErrorPageProps } from "@/components/layout/ErrorPage";

/**
 * In place of any page that threw with no error page nearer it: the tools,
 * the march's sign-up, the staff login. It takes the place of the route
 * group's layout too, so it has no header.
 */
export default function RootError(props: ErrorPageProps) {
  return (
    <main>
      <ErrorPage {...props} />
    </main>
  );
}
