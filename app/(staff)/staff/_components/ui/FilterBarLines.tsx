"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Holding a filter bar as it is: `hold` while a menu in it is choosing several,
 * as each choice changes the URL, and `release` once it's done.
 */
const BarHold = createContext({ hold: () => {}, release: () => {} });

export const useBarHold = () => useContext(BarHold);

/**
 * A filter bar's row. It starts afresh when its URL, `urlKey`, changes, so a menu
 * chosen from closes. While it's held, it keeps what it was showing instead,
 * whatever the page sends, so the menu held open, and the chip whose choices have
 * all gone, stay until it's released.
 */
export default function FilterBarLines({
  className,
  urlKey,
  children,
}: {
  className: string;
  urlKey?: string;
  children: ReactNode;
}) {
  const [held, setHeld] = useState<{ children: ReactNode; urlKey?: string } | null>(null);
  const shown = held ?? { children, urlKey };
  return (
    <BarHold.Provider
      value={{ hold: () => setHeld((now) => now ?? { children, urlKey }), release: () => setHeld(null) }}
    >
      <Lines key={shown.urlKey} className={className}>
        {shown.children}
      </Lines>
    </BarHold.Provider>
  );
}

/**
 * The row, which knows whether what's in it all fits on one line. If not, it's
 * marked `data-stacked`, for its last child, the chips, to start a line of their
 * own, whatever else then has room. CSS alone can't say so: a flex row fills each
 * line with what it can. The last child counts as its own children side by side,
 * as it's as wide as the row once stacked.
 */
function Lines({ className, children }: { className: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const bar = row.current!;
    const side = (parent: Element, widths: number[]) =>
      widths.reduce((sum, width) => sum + width, 0) +
      Math.max(widths.length - 1, 0) * parseFloat(getComputedStyle(parent).columnGap);
    const widthOf = (element: Element) => element.getBoundingClientRect().width;
    // What a box that grows asks for, its flex-basis, not the width it has grown to: that depends on whether it's
    // stacked, so a bar once stacked would stay so, and a phone's bar could settle either way.
    const asksFor = (element: Element) => parseFloat(getComputedStyle(element).flexBasis) || widthOf(element);
    const measure = () => {
      const kids = [...bar.children];
      const chips = kids.pop()!;
      // A chip's menu, beside it in the markup, opens over the page and takes no room in the row.
      const inRow = [...chips.children].filter((chip) => !chip.hasAttribute("popover"));
      const needed = side(bar, [...kids.map(asksFor), side(chips, inRow.map(widthOf))]);
      setStacked(needed > bar.clientWidth);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    for (const element of bar.querySelectorAll(":scope > *, :scope > :last-child > *")) observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={row} className={className} data-stacked={stacked || undefined}>
      {children}
    </div>
  );
}
