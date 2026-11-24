"use client";

import ErrorMain, { type ErrorPageProps } from "@/components/layout/ErrorMain";

// In place of a page here that threw, inside this layout, so its header and footer stay.
export default function PageError(props: ErrorPageProps) {
  return <ErrorMain {...props} />;
}
