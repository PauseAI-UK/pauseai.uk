// How the browser asks the site's own routes and files: the one place its
// code calls fetch() (ESLint), so every call checks the answer's status. A
// route answers a form it refuses with a FormResult, as 200
// (lib/form-result.ts), so anything else is the server having gone wrong,
// and is thrown, for the form to say it couldn't be reached.

/** The response, if it's ok. */
function answered(path: string, response: Response): Response {
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response;
}

/** The JSON at one of the site's own paths. Throws when it can't be reached, or answers anything but ok. */
export async function getJson<Answer>(path: string): Promise<Answer> {
  return (await answered(path, await fetch(path)).json()) as Answer;
}

/** The bytes of one of the site's own files, such as a font. Throws as getJson does. */
export async function getBytes(path: string): Promise<Uint8Array> {
  return new Uint8Array(await answered(path, await fetch(path)).arrayBuffer());
}

/** What one of the site's own routes answers to `body`, posted as JSON. Throws as getJson does. */
export async function postJson<Answer>(path: string, body: unknown): Promise<Answer> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await answered(path, response).json()) as Answer;
}
