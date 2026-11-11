"use client";

import NextErrorPage from "next/dist/client/components/builtin/global-error";
import { useErrorTold } from "@/components/layout/useErrorTold";

/**
 * In place of any page that threw, for visitors and staff alike: Next's own
 * error page, which it shows when a site has no global-error.tsx
 * (https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error),
 * after telling the site of an error the browser threw.
 */
export default function GlobalError({ error }: { error: unknown }) {
  useErrorTold(error);
  return <NextErrorPage error={error} />;
}
