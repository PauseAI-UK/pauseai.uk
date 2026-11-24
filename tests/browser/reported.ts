// What components tell the site of in browser tests. tests/vitest.setup.browser.tsx
// mocks the site's own reporter (reportBrowserError) to keep each error here,
// and fails a test that leaves one: a test of a failure takes what it
// expects with takeReported(), or hands the component a `report` of its own.
const reported: unknown[] = [];

/** Keeps what the site would be told of. */
export function report(_kind: string, thrown: unknown) {
  reported.push(thrown);
}

/** What the site would have been told of since the last call, taken, so the test doesn't fail on it. */
export function takeReported(): unknown[] {
  return reported.splice(0);
}
