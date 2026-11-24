// What a form's server code answers, for visitors' forms and staff's alike
// (docs/code-structure.md, "Errors"): that it's done, with whatever the
// form needs next, or that it's refused, with a reason. The reason is a
// code, one of a fixed set, never a sentence: the component that shows the
// form says it in words from its own feature's copy, so the wording isn't
// chosen deep in the server's code, and a route and a Server Action answer
// alike.

/**
 * One of a fixed set of codes, such as "postcode-not-found". Plain text,
 * which is what a sentence is, is `never`, so a reason can't be one.
 */
export type Code<Codes extends string> = string extends Codes ? never : Codes;

/** A form refused, and why. */
export type Refused<Reason extends string> = { ok: false; reason: Code<Reason> };

/**
 * A form refused for what's in its fields: which ones, each with what's
 * wrong with it, a code too. For a form that says so beside each field.
 */
export type RefusedFields<Reason extends string, Fields extends Record<string, string>> = Refused<Reason> & {
  fields: { [Field in keyof Fields]?: Code<Fields[Field]> };
};

/** What a form's server code answers: done, with `More` for the form, or refused for one of `Reason`. */
export type FormResult<Reason extends string, More extends object = object> = ({ ok: true } & More) | Refused<Reason>;

/** Refuses a form, for `reason`. */
export function refused<const Reason extends string>(reason: Code<Reason>): Refused<Reason> {
  return { ok: false, reason };
}
