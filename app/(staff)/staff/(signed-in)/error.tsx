"use client";

import StaffError from "../_components/shell/StaffError";
import type { ErrorPageProps } from "@/components/layout/ErrorMain";

// In place of a signed-in page that threw, inside this layout, so the navigation stays.
export default function PageError(props: ErrorPageProps) {
  return <StaffError {...props} />;
}
