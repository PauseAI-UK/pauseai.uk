"use client";

import ErrorMain, { type ErrorPageProps } from "@/components/layout/ErrorMain";

// In place of the sign-up page if it throws, inside this layout, so its header and footer stay; the layout's skip
// link leads to it, as to the page.
export default function PageError(props: ErrorPageProps) {
  return <ErrorMain {...props} id="main" />;
}
