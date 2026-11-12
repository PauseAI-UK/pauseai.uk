import type { ReactNode } from "react";
import { m } from "./classes";

/**
 * The march sign-up's frame (../layout.tsx): its type and colours. The
 * stylesheet's element styles stay inside it.
 */
export default function MarchSignupFrame({ children }: { children: ReactNode }) {
  return <div className={m("frame")}>{children}</div>;
}
