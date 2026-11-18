"use client";

import { useEffect, useReducer } from "react";

/**
 * Draws a component again whenever the page, or anything in it, scrolls,
 * or the window changes size, while `on`: for something placed in the
 * window by where something else is, such as a bubble under a link in an
 * editor (LinkPeek), to follow it.
 */
export function useFollowScroll(on: boolean) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!on) return;
    window.addEventListener("scroll", redraw, true);
    window.addEventListener("resize", redraw);
    return () => {
      window.removeEventListener("scroll", redraw, true);
      window.removeEventListener("resize", redraw);
    };
  }, [on]);
}
