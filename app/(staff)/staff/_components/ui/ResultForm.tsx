"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { TextArea, TextInput } from "@/components/ui/Controls";
import { FieldError } from "@/components/ui/Field";
import { FilterForm, FormStack } from "@/components/ui/Form";
import { useFormResult, type NotDone } from "@/components/ui/useFormResult";
import type { FormResult } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import Alert from "./Alert";

/**
 * Why the form around wasn't done, and its words for that, for its Refusal
 * and its fields: nothing while it's done. `fresh` is for what a send has
 * just answered, as against what the form started with.
 */
const Told = createContext<{ reason: string; said: string; fresh: boolean } | undefined>(undefined);

/**
 * Brings what it's around into view as it appears, at once: a refusal said
 * past the window's edge, under a long form or above a page scrolled down,
 * is one nobody reads.
 */
function InView({ children }: { children: ReactNode }) {
  const here = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Not handed back: some browsers answer a promise, which React would take for the effect's tidying up.
    void here.current!.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);
  return <div ref={here}>{children}</div>;
}

/** Tells the page what a form in it says at the page's top. */
const Page = createContext<(said: string | undefined) => void>(() => undefined);

/**
 * A staff form whose action answers a result (lib/form-result.ts): any form
 * that sends a Server Action. Refused, it says why in its feature's words
 * for the reason (`says`), where its Refusal is. An action that throws, or
 * never arrives, it says there too, in the kit's words, where a plain form
 * would lose the page to the error page. Either way it stays as it was,
 * with what was typed, ticked and chosen: React resets a form once its
 * action ends, and this one lets it only when the action is done.
 *
 * A reason in `atTop` is said at the top of the page (RefusalPlace) instead:
 * that the thing has gone since the page loaded, which often takes the form
 * with it as the page catches up. `done` is called with the action's answer
 * when it isn't refused, and what was sent. `starts` is what it's refused
 * for from the start. `stack` lays its fields in a column, as a FormStack
 * does, and `filters` in a row along their bottoms, as a FilterForm does.
 */
export function ResultForm<Reason extends string, More extends object = object>({
  action,
  says,
  atTop = [],
  done,
  starts,
  stack = false,
  filters = false,
  onReset,
  children,
  ...form
}: Omit<ComponentProps<"form">, "action"> & {
  action: (form: FormData) => Promise<FormResult<Reason, More>>;
  says: Record<Reason, string>;
  atTop?: readonly Reason[];
  done?: (result: { ok: true } & More, sent: FormData) => void;
  starts?: NotDone<Reason>;
  stack?: boolean;
  filters?: boolean;
}) {
  const tell = use(Page);
  // Whether the send that's going, or the last one, isn't done: until it is, the form isn't to be reset.
  const keep = useRef(false);
  const [send, notDone, , sent] = useFormResult(action, {
    starts,
    done: (result, sent) => {
      keep.current = false;
      done?.(result, sent);
    },
    before: () => {
      keep.current = true;
      tell(undefined);
    },
    elsewhere: (reason) => {
      if (!atTop.includes(reason)) return false;
      tell(says[reason]);
      return true;
    },
  });
  const told = notDone && {
    reason: notDone,
    said: notDone === "failed" ? staffVocabulary.notDone : says[notDone],
    fresh: sent !== undefined,
  };
  const Form = stack ? FormStack : filters ? FilterForm : "form";
  return (
    <Form
      {...form}
      action={send}
      onReset={(event) => {
        // The reset React makes as an action ends, which a form that wasn't done refuses, once.
        if (keep.current) {
          keep.current = false;
          event.preventDefault();
        } else onReset?.(event);
      }}
    >
      <Told value={told}>{children}</Told>
    </Form>
  );
}

/**
 * Where a ResultForm says why it wasn't done: under the field it's about,
 * or under its button. Nothing till then. Every ResultForm has one. What a
 * send has just answered is brought into view.
 */
export function Refusal() {
  const told = use(Told);
  if (!told) return null;
  const words = <FieldError announce="alert">{told.said}</FieldError>;
  return told.fresh ? <InView>{words}</InView> : words;
}

/** Whether the form around was refused for one of `reasons`, which a field it's about shows by being marked wrong. */
function useWrong(reasons: readonly string[]): boolean {
  const told = use(Told);
  return told !== undefined && reasons.includes(told.reason);
}

type Wrong = {
  /** The form's reasons that are about this field. */
  wrong: readonly string[];
};

/**
 * A ResultForm's text box, marked wrong (aria-invalid) while the form is
 * refused for one of `wrong`, as well as whenever it's told it is.
 */
export function RefusedTextInput({ wrong, ...props }: ComponentProps<typeof TextInput> & Wrong) {
  const refused = useWrong(wrong);
  return <TextInput {...props} aria-invalid={refused || props["aria-invalid"]} />;
}

/** The same, for a text area. */
export function RefusedTextArea({ wrong, ...props }: ComponentProps<typeof TextArea> & Wrong) {
  const refused = useWrong(wrong);
  return <TextArea {...props} aria-invalid={refused || props["aria-invalid"]} />;
}

/**
 * For what isn't a form but can find its thing gone, such as a box that
 * saves as it's ticked (useSave): says so at the top of the page, as a
 * ResultForm's `atTop` does, or with nothing, takes it away.
 */
export function useTellPage(): (said: string | undefined) => void {
  return use(Page);
}

/**
 * Around the staff pages: says at their top, as an Alert, what a form in
 * the page says there (a ResultForm's `atTop`), brought into view however
 * far down the page is, until another form is sent or the page's address
 * changes.
 */
export function RefusalPlace({ children }: { children: ReactNode }) {
  // What's said, and the address it was said at.
  const [told, setTold] = useState<{ said: string; at: string }>();
  const here = useRef("");
  return (
    <Page value={(said) => setTold(said === undefined ? undefined : { said, at: here.current })}>
      {/* A page built ahead of time, as the gallery's are, has no query to read till it's in the browser. */}
      <Suspense fallback={null}>
        <SaidHere
          told={told}
          arrived={(address) => {
            here.current = address;
            // Somewhere else now, so what was said of where they were is dropped, and isn't there if they come back.
            setTold(undefined);
          }}
        />
      </Suspense>
      {children}
    </Page>
  );
}

/** What a RefusalPlace has been told, while the page is still at the address it was said at; and tells it each address the page arrives at. */
function SaidHere({ told, arrived }: { told?: { said: string; at: string }; arrived: (address: string) => void }) {
  const address = `${usePathname()}?${useSearchParams()}`;
  const arrive = useEffectEvent(arrived);
  useEffect(() => arrive(address), [address]);
  return told?.at === address ? (
    <InView>
      <Alert>{told.said}</Alert>
    </InView>
  ) : null;
}
