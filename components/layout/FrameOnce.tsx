"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Whether a page is already inside the site's header and footer. */
const Framed = createContext(false);

/**
 * `header`, `children`, then `footer`; but only `children` inside another
 * FrameOnce, so a page drawn inside a section's layout, such as the 404
 * page, never shows a second header and footer.
 */
export default function FrameOnce({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  if (useContext(Framed)) return <>{children}</>;
  return (
    <Framed.Provider value={true}>
      {header}
      {children}
      {footer}
    </Framed.Provider>
  );
}
