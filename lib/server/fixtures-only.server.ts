import "server-only";
import { notFound } from "next/navigation";
import { config } from "./config.server";

/** A 404 outside a fixture build: for a page only the storyboard visits. */
export function fixturesOnly(): void {
  if (!config.fixtures) notFound();
}
