import { configDefaults, defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
// With its extension, and written in TypeScript that Node can strip, as
// scripts/test-changed.mjs loads this file in Node itself.
import { HungFiles } from "./tests/hung-files.mts";

// Two projects, one coverage report (see docs/testing.md):
//
// - "node" runs logic tests (*.test.ts, or .tsx for JSX) in Node: lib/,
//   app/api/, sitemap.
// - "browser" runs component tests (*.browser.test.tsx) in real Chromium via
//   Playwright, so layout, canvas and matchMedia are the real thing.
//
// tests/storyboard/ is the Playwright suite, run separately.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // A *.server.ts module imports "server-only", which throws outside a
      // React server build. Tests run that code directly, so give them the no-op.
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    // Vitest's own reporters, and one that stops the run at a test file
    // that never finishes, naming it (tests/hung-files.mts).
    reporters: [...configDefaults.reporters, new HungFiles()],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.{ts,tsx}"],
          // Test files that need Postgres each make their own database
          // (tests/database.ts), so they can run in parallel. .next/** and
          // .netlify/** matter on Netlify's cached builds: a previous
          // build's leftover .next/standalone has its own copies of test
          // files, compiled against a production build with no dev-mode
          // react internals, so they fail to even load.
          // backup/ is a package of its own, with its own tests (backup/README.md).
          // .claude/** holds Claude Code's agents' worktrees: whole checkouts,
          // other branches' tests among them.
          exclude: [
            "**/node_modules/**",
            ".claude/**",
            "plans/**",
            "tmp/**",
            "backup/**",
            ".next/**",
            ".next-serve/**",
            ".netlify/**",
            "**/*.browser.test.*",
          ],
          setupFiles: ["./tests/vitest.setup.node.ts"],
          globalSetup: ["./tests/vitest.global-setup.node.ts"],
        },
      },
      {
        extends: true,
        // Next's client modules (next/link, next/image) read build-time
        // flags from process.env, which only exists when Next compiles them.
        define: { "process.env": JSON.stringify({ NODE_ENV: "test" }) },
        // Next's own ES module builds of these. The default entry points are
        // CommonJS, and Vite's interop around a CommonJS import shows up in
        // coverage as a branch, taken one way or the other depending on how
        // Vite happened to bundle the dependency.
        resolve: {
          alias: {
            "next/link": path.resolve(import.meta.dirname, "node_modules/next/dist/esm/client/link.js"),
            "next/form": path.resolve(import.meta.dirname, "node_modules/next/dist/esm/client/form.js"),
            "next/image": path.resolve(import.meta.dirname, "node_modules/next/dist/esm/shared/lib/image-external.js"),
            "next/script": path.resolve(import.meta.dirname, "node_modules/next/dist/esm/client/script.js"),
          },
        },
        // Pre-bundle every browser dependency up front. If Vite discovers one
        // mid-run it re-optimises, which can load a second copy of React into
        // the page or lose track of the test runner.
        optimizeDeps: {
          include: [
            "react",
            "react-dom",
            "react-dom/client",
            "react-dom/server",
            "client-only",
            "react/jsx-dev-runtime",
            "next/link",
            "next/form",
            "next/image",
            "next/navigation",
            "next/script",
            "next/dist/client/components/is-next-router-error",
            "next/dist/client/components/not-found",
            "next/dist/client/components/redirect",
            "next/dist/client/components/unrecognized-action-error",
            "vitest-browser-react",
            "d3-geo",
            "topojson-client",
            "pdf-lib",
            "jszip",
            "qrcode-generator",
            "jsqr",
            "rough-notation",
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-blockquote",
            "@tiptap/pm/model",
            "@tiptap/pm/state",
            "@tiptap/pm/transform",
            "unpdf",
          ],
        },
        test: {
          name: "browser",
          include: ["**/*.browser.test.{ts,tsx}"],
          exclude: [
            "**/node_modules/**",
            ".claude/**",
            "tests/**",
            "plans/**",
            "tmp/**",
            ".next/**",
            ".next-serve/**",
            ".netlify/**",
          ],
          setupFiles: ["./tests/vitest.setup.browser.tsx"],
          // Drawing and exporting images is slow when every file runs at once, so waits get longer than the default second.
          expect: { poll: { timeout: 5000 } },
          // Rendering and exporting images has taken over the 15s default on a loaded CI runner.
          testTimeout: 60_000,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Every source file, so one that no test imports shows as 0% rather
      // than silently missing from the report.
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "next.config.ts",
        "proxy.ts",
        "instrumentation.ts",
        "netlify/functions/**/*.ts",
        "netlify/scheduled.ts",
      ],
      // Only code that runs on the live site. page.tsx and layout.tsx are
      // left out as async server components can't render in Vitest and
      // layout.tsx needs next/font: they're kept thin, and
      // tests/storyboard/public-pages.spec.ts loads every route instead.
      // The fakes that answer for outside services in a fixture build, and
      // the gallery's examples, never run there. The gallery's guard does,
      // so it stays. No other exclusions, and no ignore comments
      // (tests/checks/coverage-ignores.test.ts). A glob's brackets are
      // escaped, as (tools) would otherwise be read as a pattern.
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/page.tsx",
        "**/layout.tsx",
        "lib/server/fixtures/**",
        "app/\\(tools\\)/gallery/_examples/**",
        "app/\\(tools\\)/gallery/_components/!(enabled.server).{ts,tsx}",
        "**/*.gallery.{ts,tsx}",
        "**/*.gallery.client.{ts,tsx}",
      ],
      reporter: ["text-summary", "json-summary", "html"],
      // Every file, on its own, at 100%.
      thresholds: { 100: true, perFile: true },
    },
  },
});
