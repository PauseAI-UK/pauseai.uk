"use client";

import type { ErrorPageProps } from "@/components/layout/ErrorPage";
import StaffErrorPage from "../_components/StaffErrorPage";

/** In place of a signed-in staff page that threw. */
export default function StaffError(props: ErrorPageProps) {
  return <StaffErrorPage {...props} />;
}
