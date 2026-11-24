import { postJson } from "@/lib/ask-server";
import type { MarchRegisterResult } from "@/lib/march-registration";

/**
 * Sends the form to app/api/march/register and gives back its answer. Throws
 * when there's no answer to give: offline, or the server erred.
 */
export function registerForMarch(input: unknown): Promise<MarchRegisterResult> {
  return postJson("/api/march/register", input);
}
