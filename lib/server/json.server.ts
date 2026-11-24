import "server-only";

// Reading a body that may not be what's expected: JSON, from an API's error
// response, a webhook's request or a form's; or a posted form. The one place
// that swallows the parse error, as "not JSON" and "not a form" are answers
// (tests/checks/caught-errors.test.ts).

/** `text` parsed as JSON, or undefined if it isn't any. */
export function parseJsonIfAny(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** A request's or response's body parsed as JSON, or undefined if it isn't any. */
export async function readJsonIfAny(body: Request | Response): Promise<unknown> {
  return parseJsonIfAny(await body.text());
}

/** A request's body as the form it posts, or undefined if it isn't one. */
export async function readFormIfAny(request: Request): Promise<FormData | undefined> {
  try {
    return await request.formData();
  } catch {
    return undefined;
  }
}

/** What a field of an API's answer says, if it's text or a number; nothing for anything else. */
export function fieldText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
