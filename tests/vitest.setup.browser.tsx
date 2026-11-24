// Setup for the "browser" Vitest project.
import { afterEach, vi } from "vitest";
import "../styles/tokens.css";
import "../styles/base.css";
import { navigation } from "./browser/navigation";

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
