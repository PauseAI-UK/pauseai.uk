"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { annotate } from "rough-notation";
import { m } from "./classes";

/** Where each mark's wobble starts, so it's drawn the same each time. */
const SEED = 1;

type Mark = "underline" | "circle" | "highlight";

/**
 * How each mark is drawn: how many times the pen goes over it, how thick
 * the pen is (the type's size over `pen`), how long a mark that draws in
 * takes, and the class the stylesheet tilts a circle and times a highlight
 * by. A highlight is one quick sweep from the left; a circle is one loop in
 * a heavier pen, just overshooting where it began.
 */
const MARKS: Record<Mark, { iterations: number; pen: number; duration: number; className?: string }> = {
  underline: { iterations: 2, pen: 9, duration: 800 },
  circle: { iterations: 1, pen: 6, duration: 800, className: "marked-circle" },
  highlight: { iterations: 1, pen: 9, duration: 350, className: "marked-highlight" },
};

/**
 * Words marked in orange by hand, as a marker pen or a highlighter would:
 * underlined, circled, or highlighted behind. rough-notation draws the mark
 * beside the words, in an SVG of its own. An underline is there from the
 * start, so it never moves as someone reads; a circle or a highlight draws
 * in once its words have scrolled a third of the way up the screen, and
 * with reduced motion they're there at once too. The pen is the frame's orange, and thickens with the type, so a
 * statement's line is heavier than a sentence's.
 */
export default function Marker({ type, children }: { type: Mark; children: ReactNode }) {
  const words = useRef<HTMLSpanElement>(null);
  const { iterations, pen: penScale, duration, className } = MARKS[type];

  useEffect(() => {
    const element = words.current!;
    const style = getComputedStyle(element);
    const size = parseFloat(style.fontSize);
    const pen = Math.max(3, Math.round(size / penScale));
    const drawIn = type !== "underline" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mark = annotate(element, {
      type,
      color: style.getPropertyValue("--march-orange").trim(),
      strokeWidth: pen,
      // An underline or a highlight runs on along every line the words wrap
      // to. An underline sits its width below the letters, so its wobble
      // never crosses them; a circle goes wider than it's tall, as a loop by
      // hand does.
      multiline: true,
      padding: type === "circle" ? [Math.round(size * 0.15), Math.round(size * 0.6)] : pen + 1,
      iterations,
      animate: drawIn,
      animationDuration: duration,
    });
    // rough-notation wobbles each mark from a random seed it keeps to itself;
    // a fixed one draws the same mark on every visit, and in every storyboard run.
    Object.assign(mark, { _seed: SEED });
    if (!drawIn) {
      mark.show();
      return () => mark.remove();
    }
    // The bottom 35% of the page's window doesn't count, so words that have
    // only just come into view aren't marked until they're further up it.
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        mark.show();
        seen.disconnect();
      },
      { root: document, rootMargin: "0px 0px -35% 0px" },
    );
    seen.observe(element);
    return () => {
      seen.disconnect();
      mark.remove();
    };
  }, [type, iterations, penScale, duration]);

  return (
    <span ref={words} className={className && m(className)}>
      {children}
    </span>
  );
}
