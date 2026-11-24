"use client";

// The layout group's examples that hand a component a function (layout.tsx).
import ErrorMain from "@/components/layout/ErrorMain";
import { Logged } from "../_components/wiring";

/** An error as the server's arrives, with a digest, so the example tells the site of nothing. */
const THROWN = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });

/** A public page that threw, its button logged. */
export function ErrorMainExample() {
  return <Logged>{(log) => <ErrorMain as="div" error={THROWN} retry={log("retry")} />}</Logged>;
}
