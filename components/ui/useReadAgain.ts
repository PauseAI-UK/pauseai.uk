"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Asks the server for the page again every `everyMs`, for as long as the
 * component using it is shown: for a page waiting on work going on
 * elsewhere, which leaves that component out once the work is done.
 */
export function useReadAgain(everyMs: number): void {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
}
