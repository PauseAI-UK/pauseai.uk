"use client";

import { useEffect, useRef } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormResult } from "@/lib/form-result";
import { TextArea } from "@/components/ui/Controls";
import { Refusal, ResultForm } from "../ui/ResultForm";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.choosing;

/**
 * The box for names to paste, one a line, and Find these, which sends
 * them, with `back` the list to show them on. It's typed into at once when
 * the bubble it's in opens (React's autoFocus would focus it as it's made,
 * hidden, not then), and Ctrl+Enter, or Cmd+Enter on a Mac, sends it, as
 * Enter is a new line. A draft that's gone, or no longer one, is said at
 * the page's top; names that couldn't be sent stay in the box.
 */
export default function PasteForm({
  action,
  back,
  className,
}: {
  action: (form: FormData) => Promise<FormResult<"gone">>;
  back: string;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const bubble = form.current!.closest("[popover]");
    if (!bubble) return;
    const opened = (event: Event) => {
      if ((event as ToggleEvent).newState === "open") form.current!.querySelector("textarea")!.focus();
    };
    bubble.addEventListener("toggle", opened);
    return () => bubble.removeEventListener("toggle", opened);
  }, []);
  return (
    <ResultForm ref={form} action={action} says={{ gone: copy.gone }} atTop={["gone"]} className={className}>
      <input type="hidden" name="back" value={back} />
      <TextArea
        name="names"
        rows={8}
        required
        aria-label={copy.pasteLabel}
        placeholder={copy.pasteLabel}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form!.requestSubmit();
          }
        }}
      />
      <Refusal />
      <SubmitButton variant="primary" size="small" fit>
        {copy.pasteTick}
      </SubmitButton>
    </ResultForm>
  );
}
