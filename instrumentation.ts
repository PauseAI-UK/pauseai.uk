import type { Instrumentation } from "next";

// Next's hooks for the server starting and for each error it throws in a
// page, a route handler, a Server Action or the proxy
// (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// Both hand over to lib/server/errors-seen.ts, which keeps what goes wrong
// and emails staff. Only in the Node.js runtime, where the database is: the
// file loads in the edge runtime too, so what needs Node is imported inside
// the check, which leaves it out of an edge bundle.

/** As the server starts: a problem reported outside a run is kept from now on (lib/server/problems.ts). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { keepProblem } = await import("@/lib/server/errors-seen");
    const { registerProblemKeeper } = await import("@/lib/server/problems");
    registerProblemKeeper(keepProblem);
  }
}

/** Each error the server throws while answering a request, which Next waits for. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { keepRequestError } = await import("@/lib/server/errors-seen");
    await keepRequestError(error, request, context);
  }
};
