// Setup for the "browser" Vitest project.
import { afterEach, vi } from "vitest";
import "../styles/tokens.css";
import "../styles/base.css";
import { navigation } from "./browser/navigation";
import { takeReported } from "./browser/reported";

// next/navigation needs Next's app router, which isn't there in a component
// test. usePathname, useSearchParams and useRouter use tests/browser/navigation.ts instead.
// Telling a Server Action the site no longer has is Next's own.
vi.mock("next/navigation", async () => ({
  unstable_isUnrecognizedActionError: (await import("next/dist/client/components/unrecognized-action-error"))
    .unstable_isUnrecognizedActionError,
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({
    push: (url: string) => navigation.pushed.push(url),
    replace: (url: string) => navigation.replaced.push(url),
    refresh: () => navigation.refreshes++,
  }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// What a component would tell the site of fails the test it's in, as an
// uncaught error would. useSave and useFormResult catch what an action
// throws so the form can say it failed, and an expect() inside a test's
// stand-in action throws into that same catch: without this, the test
// carries on and passes. A test of a failure takes what it expects
// (tests/browser/reported.ts).
vi.mock("@/lib/browser-errors", async (original) => ({
  ...(await original<typeof import("@/lib/browser-errors")>()),
  reportBrowserError: (await import("./browser/reported")).report,
}));

afterEach(() => {
  const thrown = takeReported();
  if (thrown.length > 0) {
    throw new Error("The component told the site of an error, which the test didn't take with takeReported()", {
      cause: thrown[0],
    });
  }
});

// The staff layout's box that says whether the sidebar is folded
// (app/(staff)/layout.tsx), open, for its fold button: on <body> here.
document.body.dataset.staffNav = "open";

afterEach(() => {
  document.body.dataset.staffNav = "open";
  navigation.pathname = "/";
  navigation.search = "";
  navigation.pushed = [];
  navigation.replaced = [];
  navigation.refreshes = 0;
  document.body.removeAttribute("data-no-analytics");
  document.body.className = "";
});
