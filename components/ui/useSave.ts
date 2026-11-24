"use client";

import { isNextRouterError } from "next/dist/client/components/is-next-router-error";
import { unstable_isUnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { useState, useTransition } from "react";
import { reportBrowserError, thrownByServer } from "@/lib/browser-errors";

type Options<Args extends unknown[], Result> = {
  /** Called as the save starts, in its transition: where an optimistic change goes, which React undoes if the save fails. */
  before?: (...args: Args) => void;
  /** Called with what the server answered, and what it was asked. */
  done?: (result: Result, ...args: Args) => void;
  report?: typeof reportBrowserError;
};

/**
 * For anything that saves by calling the server from an event, not a form's
 * own action: a box that saves as it's ticked, a button that sends. Returns
 * `run`, which calls `save`; `saving`, while any call is going; and `failed`,
 * once a call has thrown, until the next one starts, for the component to
 * say so where the person is looking.
 *
 * A call throws when the request never arrived or the server threw. Without
 * this, the nearest error page replaces the whole page for a save that could
 * be tried again, or nothing shows at all. The site is told of one the
 * browser threw; the server has kept its own.
 *
 * Two things thrown are Next's own and are thrown on, to be dealt with as
 * ever: a redirect, which it follows, and a Server Action of a build since
 * replaced, for which the error page reloads (useErrorTold).
 */
export function useSave<Args extends unknown[], Result>(
  save: (...args: Args) => Promise<Result>,
  { before, done, report = reportBrowserError }: Options<Args, Result> = {},
): [run: (...args: Args) => void, saving: boolean, failed: boolean] {
  const [saving, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const run = (...args: Args) => {
    setFailed(false);
    start(async () => {
      before?.(...args);
      let result: Result;
      try {
        result = await save(...args);
      } catch (error) {
        if (isNextRouterError(error) || unstable_isUnrecognizedActionError(error)) throw error;
        if (!thrownByServer(error)) report("browser-other", error);
        setFailed(true);
        return;
      }
      done?.(result, ...args);
    });
  };
  return [run, saving, failed];
}
