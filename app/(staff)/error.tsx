"use client";

import ErrorMain, { type ErrorPageProps } from "@/components/layout/ErrorMain";

// In place of a staff page outside the signed-in ones that threw, such as the login page.
export default function PageError(props: ErrorPageProps) {
  return <ErrorMain {...props} />;
}
