// Stands in for React's cache() in Node tests. React's own memoizes only
// while it renders a request, so in a test it calls straight through. This
// one memoizes as React does within one request, by each argument's
// identity, until newRequest():
// vi.mock("react", async (original) => ({ ...(await original()), cache: (await import("@/tests/request-cache")).cache })).

type Call = { args: unknown[]; result: unknown };

let calls = new Map<unknown, Call[]>();

/** Forgets every result, as a new request starts with none. */
export function newRequest() {
  calls = new Map();
}

export function cache<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
  return (...args) => {
    const made = calls.get(fn) ?? [];
    calls.set(fn, made);
    const same = made.find((call) => call.args.length === args.length && call.args.every((arg, i) => arg === args[i]));
    if (same) return same.result as Result;
    const result = fn(...args);
    made.push({ args, result });
    return result;
  };
}
