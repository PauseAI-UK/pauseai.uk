import { useEffect, useState } from "react";
import { getJson } from "@/lib/ask-server";

/** How often an open page asks for the count again, in milliseconds: the minute the server caches it for. */
export const SIGNUPS_REFRESH_MS = 60_000;

/** How many are going, from app/api/march/signups: null when Luma can't say. Throws when the server can't be reached. */
export async function fetchMarchSignups(): Promise<number | null> {
  const { count } = await getJson<{ count: number | null }>("/api/march/signups");
  return count;
}

/**
 * The march's count, starting from the one the page was rendered with and
 * asked for again every SIGNUPS_REFRESH_MS while the page is in view, and
 * whenever it comes back into view, as when someone returns from sharing it.
 * A count that couldn't be had keeps the last one shown.
 */
export function useMarchSignups(initial: number | null, load: () => Promise<number | null> = fetchMarchSignups) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      load().then(
        (next) => {
          if (next !== null) setCount(next);
        },
        () => {},
      );
    };
    const timer = setInterval(refresh, SIGNUPS_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  return count;
}
