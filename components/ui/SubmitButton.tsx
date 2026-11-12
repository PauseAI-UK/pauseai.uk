"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";
import { useFormLeaving } from "./useLeaving";

/**
 * A form's submit button that is pending while its work goes on: while the
 * form's action runs, for a form whose action is a function (a Server
 * Action); or, for one that posts to a URL, from its sending until the
 * next page comes. A browser drops the focus from a button as it's
 * disabled, to the page; so where the focus was as it was pressed (the
 * button, or a field Enter was pressed in) gets it back when its work is
 * done, unless it went somewhere else meanwhile.
 */
export function SubmitButton({ onClick, ...props }: Omit<ComponentProps<typeof Button>, "type" | "pending" | "ref">) {
  const { pending } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  const leaving = useFormLeaving(button);
  const was = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!pending && was.current && document.activeElement === document.body) was.current.focus();
  }, [pending]);
  return (
    <Button
      {...props}
      ref={button}
      type="submit"
      pending={pending || leaving}
      onClick={(event) => {
        was.current = document.activeElement as HTMLElement;
        onClick?.(event);
      }}
    />
  );
}
