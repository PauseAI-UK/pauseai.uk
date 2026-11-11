"use client";

import { useState } from "react";
import ErrorPage from "@/components/layout/ErrorPage";
import { Logged } from "../_components/wiring";

// The header and footer group's examples that need callbacks: client
// components with no props, each callback logged.

/** An example's error is nobody's to hear of, so it isn't told to the site. */
export function tellNoOne(): void {}

/** In place of a page that threw in the browser: Try again is logged. */
export function ErrorPageExample() {
  const [error] = useState(() => new TypeError("rows is undefined"));
  return <Logged>{(log) => <ErrorPage error={error} retry={log("retry")} report={tellNoOne} />}</Logged>;
}
