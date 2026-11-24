// How the browser asks the site's own routes for JSON: the one place its
// code calls fetch() (ESLint), so every call checks the answer's status. A
// route answers a form it refuses with a FormResult, as 200
// (lib/form-result.ts), so anything else is the server having gone wrong,
// and is thrown, for the form to say it couldn't be reached.

async function answerOf<Answer>(path: string, response: Response): Promise<Answer> {
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return (await response.json()) as Answer;
}

/** The JSON at one of the site's own paths. Throws when it can't be reached, or answers anything but ok. */
export async function getJson<Answer>(path: string): Promise<Answer> {
  return answerOf(path, await fetch(path));
}

/** What one of the site's own routes answers to `body`, posted as JSON. Throws as getJson does. */
export async function postJson<Answer>(path: string, body: unknown): Promise<Answer> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return answerOf(path, response);
}
