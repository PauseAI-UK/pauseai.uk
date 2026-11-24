"use client";

import { isNextRouterError } from "next/dist/client/components/is-next-router-error";
import { unstable_isUnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { useActionState } from "react";
import { reportBrowserError, thrownByServer } from "@/lib/browser-errors";
import type { FormResult } from "@/lib/form-result";

/** Why a form wasn't done: one of its action's own reasons, or "failed", as its request never arrived or the server threw. */
export type NotDone<Reason extends string> = Reason | "failed";

type Options<Reason extends string, More extends object> = {
  /** What it starts as not done for, as a page that comes already refused shows it. */
  starts?: NotDone<Reason>;
  /** Called as the form is sent. */
  before?: () => void;
  /** Called with what the server answered when it's done, and what it was sent. */
  done?: (result: { ok: true } & More, sent: FormData) => void;
  /**
   * Called with the reason when it's refused. True if it has said so itself,
   * somewhere that outlasts the form, and the form then isn't `notDone`: an
   * action that says a thing has gone often takes the form away with it.
   */
  elsewhere?: (reason: Reason) => boolean;
  report?: typeof reportBrowserError;
};

/**
 * For a form whose action answers a result (lib/form-result.ts). Returns
 * `send`, for the form's `action`; why it's `notDone`, once it has been
 * refused or has failed, until it's next sent; `sending`, while it goes;
 * and what was `sent` when it wasn't done. React resets a form to how it
 * started once its action ends, whatever it answered, so a form that isn't
 * done has to keep what was typed itself (as ResultForm does).
 *
 * A form whose action throws is "failed", for the form to say so where the
 * person is looking, as a save from an event is (useSave). Without this the
 * nearest error page replaces the whole page, and what was typed with it.
 * The site is told of what the browser threw; the server has kept its own.
 *
 * Two things thrown are Next's own and are thrown on, as useSave does: a
 * redirect, which it follows, and a Server Action of a build since replaced.
 */
export function useFormResult<Reason extends string, More extends object = object>(
  action: (form: FormData) => Promise<FormResult<Reason, More>>,
  { starts, before, done, elsewhere, report = reportBrowserError }: Options<Reason, More> = {},
): [
  send: (form: FormData) => void,
  notDone: NotDone<Reason> | undefined,
  sending: boolean,
  sent: FormData | undefined,
] {
  // The reason is a plain string to React, whose types can't follow one not yet known (Awaited<Reason>).
  const [stands, send, sending] = useActionState<{ notDone: string; sent?: FormData } | undefined, FormData>(
    async (_was, form) => {
      before?.();
      let result: FormResult<Reason, More>;
      try {
        result = await action(form);
      } catch (error) {
        if (isNextRouterError(error) || unstable_isUnrecognizedActionError(error)) throw error;
        if (!thrownByServer(error)) report("browser-other", error);
        return { notDone: "failed", sent: form };
      }
      if (result.ok) {
        done?.(result, form);
        return undefined;
      }
      const reason = result.reason as Reason;
      return elsewhere?.(reason) ? undefined : { notDone: reason, sent: form };
    },
    starts && { notDone: starts },
  );
  return [send, stands?.notDone as NotDone<Reason> | undefined, sending, stands?.sent];
}
