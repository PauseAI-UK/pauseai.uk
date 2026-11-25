import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The database's connection string: only lib/server/db.server.ts connects, and the
// test helper points it at a fresh database.
const DATABASE_URL_RULE = {
  selector: "MemberExpression[property.name='NETLIFY_DB_URL']",
  message: "Only lib/server/db.server.ts connects to the database. Query through it.",
};
const PG_IMPORT = { name: "pg", message: "Only lib/server/db.server.ts connects to the database. Query through it." };

// A test runs on the schema the migrations make, so what it proves holds for
// the site's. Changing the schema to force an error proves only that a
// changed schema errs, and can leave the change behind for the next test.
const SCHEMA_CHANGE = String.raw`/\b(?:ALTER|DROP|CREATE)\s+(?:TABLE|CONSTRAINT|INDEX|TRIGGER|FUNCTION|VIEW)\b|DISABLE\s+TRIGGER|session_replication_role/i`;
const SCHEMA_CHANGE_MESSAGE =
  "Tests use the schema the migrations make. To reach a failure, inject it at a seam (mock the module with the real functions passed through); for old data, use an entry the schema allows.";
const SCHEMA_CHANGE_RULES = [
  { selector: `Literal[value=${SCHEMA_CHANGE}]`, message: SCHEMA_CHANGE_MESSAGE },
  { selector: `TemplateElement[value.raw=${SCHEMA_CHANGE}]`, message: SCHEMA_CHANGE_MESSAGE },
];

// A storyboard flow opens a bubble or a menu with openBubble
// (tests/storyboard/settle.ts), which waits for the scroll a bubble starts as
// it opens and returns what's open. A flow that presses the button and finds
// the popover by its selector can take its frame, or press inside the bubble,
// while the page still scrolls, so the selector is kept to settle.ts, and to
// frame.ts, which only asks whether one is open.
const OPEN_BUBBLE_MESSAGE =
  "Open a bubble with openBubble (tests/storyboard/settle.ts), which waits for the scroll it starts, and returns the open bubble.";
const OPEN_BUBBLE_RULES = [
  { selector: "Literal[value=/:popover-open/]", message: OPEN_BUBBLE_MESSAGE },
  { selector: "TemplateElement[value.raw=/:popover-open/]", message: OPEN_BUBBLE_MESSAGE },
];

// A flow reloads a page with reload (tests/storyboard/settle.ts), from the
// top. The browser puts a reloaded page back where it was scrolled, at a
// moment that depends on how far the page has loaded, so a frame after a
// reload of a scrolled page landed a few dozen pixels apart between runs.
const RELOAD_RULE = {
  selector: "CallExpression[callee.property.name='reload']",
  message:
    "Reload with reload (tests/storyboard/settle.ts), which scrolls to the top first, so the frame lands the same.",
};

// A flow puts the caret at the start or end of an editor with caretAtStart or
// caretAtEnd (tests/storyboard/editor-steps.ts), which wait until it's there.
// Ctrl+Home pressed by itself, straight after a click, lost to ProseMirror
// putting back the click's caret, and the words typed next went at the end.
const CARET_KEYS_RULE = {
  selector: "CallExpression[callee.property.name='press'] Literal[value=/^(Control|Meta|ControlOrMeta)\\+(Home|End)$/]",
  message:
    "Put the caret at an editor's start or end with caretAtStart or caretAtEnd (tests/storyboard/editor-steps.ts), which wait until it's there.",
};

// The site's settings are read from the environment only in
// lib/server/config.server.ts, which gives each one shape for every caller. The
// database's connection string has its own rule, above.
const PROCESS_ENV_RULE = {
  selector: "MemberExpression[object.name='process'][property.name='env'][parent.property.name!='NETLIFY_DB_URL']",
  message:
    "Read settings from config (lib/server/config.server.ts), which reads and normalises each environment variable.",
};

// The site's own address: every absolute URL on it, in an email or a
// redirect, comes from siteUrl() in lib/site-url.server.ts, which uses the deploy's
// address. A request's own URL or Host is the wrong one on Netlify
// (main--pauseaiuk.netlify.app), and whoever sends the request can set it.
const SITE_URL_RULE = {
  selector: [
    "MemberExpression[property.name=/^(SITE_ORIGIN|siteOrigin)$/]",
    "MemberExpression[property.name='url'][object.name=/^req(uest)?$/]",
    "MemberExpression[property.name=/^(origin|host|hostname)$/][object.property.name='nextUrl']",
    "CallExpression[callee.property.name='get'][arguments.0.value=/^(host|origin|x-forwarded-host)$/i]",
  ].join(", "),
  message:
    "Build URLs on this site with siteUrl() from lib/site-url.server.ts. The request's own URL and Host are netlify.app on Netlify, and can be forged.",
};

// Outside services are called only from their bindings in
// lib/server/outside-services/, through outsideFetch, so a fixture build
// answers from lib/server/fixtures/ instead. Nothing else imports outsideFetch,
// and server code never calls fetch() itself.
const OUTSIDE = "lib/server/outside-services";
const OUTSIDE_FETCH_IMPORT = {
  group: ["**/outside-fetch.server"],
  importNames: ["outsideFetch"],
  message: `Outside services are called only from their bindings in ${OUTSIDE}/. Use one, or add one there.`,
};
// An error's words go into the database by three ways: with a problem
// (problem()), as an error on the Errors page (errors-seen.server.ts), and
// in a column, with what kind of failure it was (keptError()). So what
// reads one back can tell a rate limit from an outage without reading the
// words. describeError(), which writes the words alone, is kept to the
// files allowed it below, each with why.
const DESCRIBE_ERROR_IMPORT = {
  group: ["**/problems.server"],
  importNames: ["describeError"],
  message:
    "To keep an error in a column, use keptError(), which keeps what kind of failure it was with its words. To report it, hand it to problem(). To log it, hand it to note().",
};
// console reaches only Netlify's logs, where nobody looks, so a failure
// written there is lost. Both of the ways to the log are in
// lib/server/problems.server.ts.
const CONSOLE_RULE = {
  selector: "MemberExpression[object.name='console']",
  message:
    "Report a failure with problem(), which keeps it, and write anything else to the log with note() (lib/server/problems.server.ts). In the browser, report an error with reportBrowserError (lib/browser-errors.ts).",
};

// A save that calls the server from an event, not a form's own action, goes
// through useSave, which says when it has failed. An async function written
// in place as an event's handler, or handed to a transition, is how one
// that doesn't gets written: what it throws is lost, or replaces the page.
const SAVE_MESSAGE =
  "Call the server from an event with useSave (components/ui/useSave.ts), which says when a save has failed; what an async function here throws is lost, or replaces the whole page.";
const SAVE_RULES = [
  {
    selector:
      "JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > :matches(ArrowFunctionExpression, FunctionExpression)[async=true]",
    message: SAVE_MESSAGE,
  },
  {
    selector:
      "CallExpression[callee.name=/^start/] > :matches(ArrowFunctionExpression, FunctionExpression)[async=true]",
    message: SAVE_MESSAGE,
  },
];

// A Server Action answers the one result shape (lib/form-result.ts), or
// always redirects, and says which where it's declared, so none returns
// nothing, a boolean or a shape of its own for its form to guess at. The
// selector reads the annotation as written, so the result isn't hidden
// behind a type alias; the reasons can be.
const ACTION =
  "Program:has(> ExpressionStatement[directive='use server']) > ExportNamedDeclaration > FunctionDeclaration";
const ACTION_ANSWERS = "returnType.typeAnnotation.typeArguments.params.0";
const ACTION_RULE = {
  selector: `${ACTION}:not([returnType.typeAnnotation.typeName.name='Promise']:matches([${ACTION_ANSWERS}.typeName.name='FormResult'], [${ACTION_ANSWERS}.type='TSNeverKeyword']))`,
  message:
    'A Server Action declares what it answers: Promise<FormResult<…>> (lib/form-result.ts), or Promise<never> for one that always redirects (docs/code-structure.md, "Errors").',
};

// A staff form that sends a Server Action is the kit's ResultForm, which
// says a refusal, and an action that threw, where the person is looking. A
// plain form loses the page to the error page, and has nowhere to say why.
// One with a `method` posts to an address, as logging in does, and is left.
const STAFF_FORM_RULES = [
  {
    selector:
      "JSXOpeningElement[name.name=/^(form|FormStack|FilterForm)$/]:not(:has(JSXAttribute[name.name='method'])) > JSXAttribute[name.name='action'] > JSXExpressionContainer",
    message:
      'A staff form that sends a Server Action is a ResultForm (ui/ResultForm), which says why it was refused, or that it failed (docs/code-structure.md, "Errors").',
  },
  {
    selector: "JSXElement[openingElement.name.name='ResultForm']:not(:has(JSXOpeningElement[name.name='Refusal']))",
    message: "A ResultForm has a <Refusal /> in it, where it says why it wasn't done.",
  },
];

// What an outside service's binding throws is an OutsideFailure, or its own
// subclass of it, so a caller can ask what kind of failure it was the same
// way for every service, and orFallback() can tell a service failing from a
// bug of ours.
const OUTSIDE_THROW_RULE = {
  selector: "ThrowStatement > NewExpression[callee.name='Error']",
  message: `An outside service's binding throws an OutsideFailure (${OUTSIDE}/outside-failure.server.ts): refusal() for an answer that isn't ok, notSet() for a key of ours that's missing, or new OutsideFailure() with its kind.`,
};

// Nothing calls fetch() itself. The server calls an outside service through
// its binding, so a fixture build can answer instead. The browser asks the
// site's own routes through lib/ask-server.ts, which throws on an answer
// that isn't ok, so no form takes a failure for an answer.
const FETCH_RULE = {
  selector: "CallExpression[callee.name='fetch']",
  message: `In the browser, ask the site's own routes with getJson() or postJson() (lib/ask-server.ts), which check the answer's status. On the server, call outside services from a binding in ${OUTSIDE}/, through outsideFetch, so fixture builds can answer instead.`,
};

// Each service's API is named only in its own binding. `host` is a regular
// expression over strings in the code, where "." also stands for "/".
// Parliament's Members API and ControlAI's letter are linked from pages
// too, so their hosts can appear anywhere; they're fetched only from their
// bindings like every other service.
const SERVICES = [
  // Luma's API, not its event pages, which are ordinary links.
  {
    name: "Luma's API",
    files: ["luma-api.server.ts", "luma-calendar.server.ts", "luma-guests.server.ts"],
    host: "(?:api2|public-api)\\.luma\\.com",
    why: "and its key stays on the server",
  },
  {
    name: "Postmark",
    files: ["postmark.server.ts"],
    host: "api\\.postmarkapp\\.com",
    why: "and email is sent with send() from lib/email/sending.server.ts",
  },
  {
    name: "Google's OAuth and Gmail",
    files: ["gmail.server.ts"],
    host: "(?:oauth2|gmail|openidconnect)\\.googleapis\\.com|accounts\\.google\\.com.o.oauth2",
    why: "and email is sent with send() from lib/email/sending.server.ts",
  },
  { name: "postcodes.io", files: ["postcodes.server.ts"], host: "api\\.postcodes\\.io" },
  // Stripe's API, not the donate links, which are payment pages on donate.stripe.com.
  {
    name: "Stripe's API",
    files: ["stripe.server.ts"],
    host: "api\\.stripe\\.com",
    why: "and its key stays on the server",
  },
  // Turnstile's server-side check, not the widget's script, which the browser loads.
  { name: "Turnstile", files: ["turnstile.server.ts"], host: "challenges\\.cloudflare\\.com.turnstile.v0.siteverify" },
].map((service) => ({ ...service, files: service.files.map((file) => `${OUTSIDE}/${file}`) }));

const hostRule = ({ name, files, host, why }) => ({
  selector: `Literal[value=/${host}/], TemplateElement[value.raw=/${host}/]`,
  message: `${name} is called only from ${files.join(" and ")}${why ? `, ${why}` : ""}.`,
});

// Email goes out only through sendWith() in lib/email/email.server.ts, which skips
// blocked addresses and records each send, so a bounce can be traced to
// what was sent. Only it uses Postmark's binding to send or unblock.
const POSTMARK_IMPORT = {
  group: ["**/postmark.server"],
  importNames: ["sendEmail", "unsuppress"],
  message:
    "Send email with send() from lib/email/sending.server.ts, which skips blocked addresses and records each send; unblock with unblock() from lib/oversight/delivery-problems.server.ts.",
};
const GMAIL_IMPORT = {
  group: ["**/gmail.server"],
  importNames: ["sendGmail"],
  message:
    "Send email with send() from lib/email/sending.server.ts, which skips blocked addresses and records each send.",
};

// Packages that make their own requests, which a fixture build can't
// answer: Node's network modules, HTTP clients, and services' own SDKs.
// Postmark and Airtable are called over their HTTP APIs, not their SDKs.
const NETWORK_IMPORTS = [
  "http",
  "https",
  "net",
  "tls",
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "undici",
  "axios",
  "node-fetch",
  "got",
  "ky",
  "postmark",
  "airtable",
].map((name) => ({
  name,
  message: `Call outside services from a binding in ${OUTSIDE}/, through outsideFetch, so fixture builds can answer instead.`,
}));

/**
 * no-restricted-syntax and no-restricted-imports for the site's own code:
 * everything above, but for what the file is allowed. `service` may name
 * its own API; `fetch` may call fetch() (the browser's one helper for it, and
 * the server's); `outsideFetch` may import it; `sendEmail`
 * may use Postmark's binding to send. `describeError` may import it. `fakes` may name every service's API,
 * as the fixtures answer for each. `env` may read process.env. `console` may write to the log. `binding` is an
 * outside service's, which throws only an OutsideFailure. `asyncHandlers`
 * may write an async function in place as a handler or a transition. `staff` adds the staff pages' rules for links
 * that look like buttons, and for forms that send a Server Action.
 */
function siteCodeRules({
  service,
  fakes = false,
  env = false,
  siteUrl = false,
  database = false,
  fetch = false,
  outsideFetch = false,
  sendEmail = false,
  describeError = false,
  console = false,
  asyncHandlers = false,
  staff = false,
  binding = false,
}) {
  return {
    "no-restricted-syntax": [
      "error",
      ...(database ? [] : [DATABASE_URL_RULE]),
      ...(env ? [] : [PROCESS_ENV_RULE]),
      ...(siteUrl ? [] : [SITE_URL_RULE]),
      ...(fakes ? [] : SERVICES.filter((other) => other !== service).map(hostRule)),
      ...(fetch ? [] : [FETCH_RULE]),
      ...(console ? [] : [CONSOLE_RULE]),
      ...(asyncHandlers ? [] : SAVE_RULES),
      ...(binding ? [OUTSIDE_THROW_RULE] : []),
      ACTION_RULE,
      ...EXTERNAL_LINK_RULES,
      ...(staff ? [...STAFF_BUTTON_LINK_RULES, ...STAFF_FORM_RULES] : []),
    ],
    "no-restricted-imports": [
      "error",
      {
        paths: [...(database ? [] : [PG_IMPORT]), ...NETWORK_IMPORTS],
        patterns: [
          ...(sendEmail ? [] : [POSTMARK_IMPORT, GMAIL_IMPORT]),
          ...(outsideFetch ? [] : [OUTSIDE_FETCH_IMPORT]),
          ...(describeError ? [] : [DESCRIBE_ERROR_IMPORT]),
        ],
      },
    ],
  };
}

// Components show state through what they render. Finding the page's
// elements and editing them directly goes behind React's back: it can
// re-render over the change, and the page's state ends up split between
// React and the DOM. Hold the state in React (useState, context) instead,
// and use a ref for an element an effect has to measure or observe.
const DOM_EDIT_MESSAGE =
  "Render this from React state, not by editing the page directly. See DIRECT_DOM_EDITS in eslint.config.mjs.";
const DIRECT_DOM_EDITS = [
  // Looking elements up across the page. Inside a ref's element is fine.
  ...[
    "querySelector",
    "querySelectorAll",
    "getElementById",
    "getElementsByClassName",
    "getElementsByTagName",
    "getElementsByName",
  ].map((property) => ({ object: "document", property, message: DOM_EDIT_MESSAGE })),
  // Changing elements, wherever they came from.
  ...[
    "classList",
    "setAttribute",
    "removeAttribute",
    "toggleAttribute",
    "innerHTML",
    "outerHTML",
    "insertAdjacentHTML",
  ].map((property) => ({ property, message: DOM_EDIT_MESSAGE })),
];
// Written before the rule, and still editing the page directly. Take a file
// off this list when it's converted; don't add to it.
const UNCONVERTED_DOM_EDITS = [
  "app/(site)/_components/HeroMarqueeEffects.tsx",
  "app/(site)/future-of-workforce-inquiry/_components/FootnoteTooltips.tsx",
  "components/layout/FooterYear.tsx",
  "components/layout/NoAnalytics.tsx",
];

// Every link out of the site opens in a new tab, and sends no referrer: the
// visitor keeps their place here (docs/style-guide.md, "Links"). The first
// catches an <a> with a literal outside URL and no target="_blank"; the second
// any <a target="_blank"> whose rel lacks noreferrer. An href that's an
// expression (href={site.shopUrl}) can't be checked here, so it's on the
// writer. Component tests are exempt below.
const EXTERNAL_LINK_RULES = [
  {
    selector:
      "JSXOpeningElement[name.name='a']:has(JSXAttribute[name.name='href'] > Literal[value=/^https?:/]):not(:has(JSXAttribute[name.name='target'] > Literal[value='_blank']))",
    message:
      'A link out of the site opens in a new tab: add target="_blank" rel="noreferrer" (docs/style-guide.md, "Links").',
  },
  {
    selector:
      "JSXOpeningElement[name.name='a']:has(JSXAttribute[name.name='target'] > Literal[value='_blank']):not(:has(JSXAttribute[name.name='rel'] > Literal[value=/noreferrer/]))",
    message: 'A link that opens in a new tab sends no referrer: add rel="noreferrer" (docs/style-guide.md, "Links").',
  },
];

// The staff pages' links show they're waiting for the next page: a link is
// ui/StaffLink, which runs its navigation as a transition and shows the line
// along the top, never next/link alone; and one that looks like a button is
// a StaffLink with buttonClass, not a plain <a> (docs/style-guide.md,
// "Buttons that wait"). StaffLink itself, and tests, are exempt below.
const STAFF_LINK_IMPORT = {
  name: "next/link",
  message:
    'In the staff pages, link with ui/StaffLink, which shows the line along the top while the next page comes (docs/style-guide.md, "Buttons that wait").',
};
const STAFF_BUTTON_LINK_RULES = [
  {
    selector:
      "JSXOpeningElement[name.name=/^(a|Link)$/]:has(JSXAttribute[name.name='className'] CallExpression[callee.name='buttonClass'])",
    message:
      'A link that looks like a button is a StaffLink with buttonClass, so it shows it\'s waiting for the next page (docs/style-guide.md, "Buttons that wait").',
  },
];

// Which folders may import which (docs/code-structure.md). lib/ is logic
// and data, so it imports neither components nor routes; the site's
// content in lib/content/ is written partly in JSX, so it may use
// components. Code is shared between routes from components/ or lib/, or
// from a _components/ folder above both, by a relative path: never from
// another route's folder, by the @/app/ alias or by a relative path that
// climbs into one. The component gallery imports every route's components
// to show them. Tests may reach across, to load what they test. These use
// typescript-eslint's copy of no-restricted-imports, so they're
// independent of the per-file lists in siteCodeRules().
const ROUTE_IMPORTS = [
  {
    group: ["@/app", "@/app/**"],
    message:
      "Share code between routes from components/ or lib/, or from a _components/ folder above both. See LAYERS in eslint.config.mjs.",
  },
  {
    regex: "^(\\./|(\\.\\./)+)(?!_components/|\\.\\./)[^/]+/(.*/)?_components(/|$)",
    message:
      "That's another route's _components/. Share code between routes from components/ or lib/, or from a _components/ folder above both.",
  },
];
// The site's code never imports tests/, which isn't part of the site: what a
// fixture build answers with instead of the outside services is in
// lib/server/fixtures/. The component gallery, a page of the site, is held
// to it too.
const TESTS_IMPORTS = [
  {
    group: ["@/tests", "@/tests/**"],
    message: "The site's code doesn't import tests/. What a fixture build needs goes in lib/server/fixtures/.",
  },
  {
    regex: "^(\\.\\./)+tests(/|$)",
    message: "The site's code doesn't import tests/. What a fixture build needs goes in lib/server/fixtures/.",
  },
];
const COMPONENT_IMPORTS = {
  group: ["@/components", "@/components/**"],
  message: "lib/ is logic and data, without React components. See LAYERS in eslint.config.mjs.",
};
// A page that sends people elsewhere does it in next.config.ts's
// redirects(), not with redirect() while rendering: on a click within the
// site, a page that redirects leaves the layout's header and footer with
// nothing between them for a moment.
const PAGE_REDIRECT = {
  name: "next/navigation",
  importNames: ["redirect", "permanentRedirect"],
  message:
    "Send people elsewhere from next.config.ts's redirects(), or, for a redirect that depends on the request, a lib/ helper the page calls first: a page that redirects while rendering shows the layout empty for a moment on a client-side navigation.",
};

// The staff interface's features (docs/code-structure.md, "Feature folders").
// Each has a folder of components, app/(staff)/staff/_components/<feature>/,
// and a folder of logic, lib/<feature>/, and is listed here with the features
// it may use. A feature's files may import the staff kit (ui/) and frame
// (shell/), their own folders, the listed features' folders, and what every
// feature stands on: lib/'s top-level files, lib/server/, lib/content/ and
// lib/email-parsing/, and components/. Of the folders beside theirs, they
// may import only those. Their tests and gallery examples may reach across.
const STAFF_COMPONENTS = "app/(staff)/staff/_components";
export const FEATURES = {
  email: [],
  accounts: ["email"],
  notes: ["accounts"],
  events: ["accounts", "email", "supporters"],
  supporters: ["accounts", "email", "politicians", "letters"],
  erasure: ["accounts", "email", "supporters", "letters"],
  politicians: ["accounts", "email", "notes", "letters", "asks"],
  asks: ["accounts"],
  mailings: ["accounts", "email", "asks", "politicians", "letters"],
  letters: ["accounts", "email", "asks"],
  broadcasts: ["accounts", "email", "supporters", "politicians", "letters", "mailings"],
  oversight: ["accounts", "email", "supporters", "politicians", "letters", "broadcasts"],
  dashboard: ["accounts", "asks", "supporters", "letters"],
  jobs: [
    "accounts",
    "email",
    "asks",
    "events",
    "supporters",
    "politicians",
    "letters",
    "mailings",
    "broadcasts",
    "oversight",
  ],
};
/** Each feature's folder of logic, lib/<feature>, where its server code is, beside lib/server/. */
export const featureLibFolders = () => Object.keys(FEATURES).map((feature) => `lib/${feature}`);
// lib/'s folders that every feature stands on.
const SHARED_LIB = ["server", "content", "email-parsing"];
// The staff kit and the staff pages' frame, which every feature's components use.
const SHARED_COMPONENTS = ["ui", "shell"];

/** A regular expression for any of `names` as a whole folder name. */
const anyOf = (names) => names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

/**
 * The imports a feature's files may not make: a folder of lib/, or a folder
 * beside its own, that's neither shared nor one of the features it uses.
 * lib/'s top-level files, and the top of _components/, are open to all.
 */
function featureImports(feature, uses) {
  const why = `${feature} may use only ${uses.length ? uses.join(", ") : "no other feature"} (FEATURES in eslint.config.mjs). Move what it needs into a folder it may use, or list the feature it needs there.`;
  const libFolders = anyOf([...SHARED_LIB, feature, ...uses]);
  return [
    { regex: `^@/lib/(?!(${libFolders})/)[^/]+/`, message: `That's another feature's lib/ folder. ${why}` },
    {
      // A relative path from lib/<feature>/ or _components/<feature>/ to a folder beside it.
      regex: `^\\.\\./(?!(${anyOf([...SHARED_LIB, ...SHARED_COMPONENTS, ...uses])})/)[^/]+/`,
      message: `That's another feature's folder. ${why}`,
    },
  ];
}

/**
 * The blocks that hold each feature to the features it uses: one for its
 * components and one for its logic. Each repeats the lists of the LAYERS
 * blocks above it, which it would otherwise replace.
 */
export function featureLayers(features) {
  return Object.entries(features).flatMap(([feature, uses]) => [
    {
      files: [`${STAFF_COMPONENTS}/${feature}/**/*.{ts,tsx}`],
      patterns: [...ROUTE_IMPORTS, ...featureImports(feature, uses)],
      paths: [STAFF_LINK_IMPORT],
    },
    {
      files: [`lib/${feature}/**/*.{ts,tsx}`],
      patterns: [...ROUTE_IMPORTS, COMPONENT_IMPORTS, ...featureImports(feature, uses)],
    },
  ]);
}

// A component's gallery examples, beside it (docs/testing.md, "The component gallery"): part of the gallery.
const GALLERY_BESIDE = "**/*.gallery{,.client}.tsx";

/**
 * typescript-eslint's no-restricted-imports for each of `layers`, leaving
 * out tests and the gallery, which may reach across; and the gallery's own.
 */
export function importRules(layers) {
  return layers
    .map(({ files, ignores = [], patterns, paths = [] }) => ({
      files,
      ignores: ["**/*.test.{ts,tsx}", "app/(tools)/gallery/**", GALLERY_BESIDE, ...ignores],
      rules: {
        "@typescript-eslint/no-restricted-imports": ["error", { patterns: [...patterns, ...TESTS_IMPORTS], paths }],
      },
    }))
    .concat({
      files: ["app/(tools)/gallery/**/*.{ts,tsx}", GALLERY_BESIDE],
      ignores: ["**/*.test.{ts,tsx}"],
      rules: { "@typescript-eslint/no-restricted-imports": ["error", { patterns: TESTS_IMPORTS }] },
    });
}
const LAYERS = [
  { files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"], patterns: ROUTE_IMPORTS },
  { files: ["app/**/page.tsx"], patterns: ROUTE_IMPORTS, paths: [PAGE_REDIRECT] },
  { files: ["lib/**/*.{ts,tsx}"], ignores: ["lib/content/**"], patterns: [...ROUTE_IMPORTS, COMPONENT_IMPORTS] },
  // The staff pages', after the two above, whose lists they'd replace, so they keep them.
  {
    files: ["app/(staff)/**/*.{ts,tsx}"],
    ignores: ["app/(staff)/staff/_components/ui/StaffLink.tsx"],
    patterns: ROUTE_IMPORTS,
    paths: [STAFF_LINK_IMPORT],
  },
  { files: ["app/(staff)/**/page.tsx"], patterns: ROUTE_IMPORTS, paths: [PAGE_REDIRECT, STAFF_LINK_IMPORT] },
  // Each feature's, after all of the above.
  ...featureLayers(FEATURES),
];

// The rules for what goes wrong that need the types, which typed linting
// gives from tsconfig (docs/code-structure.md, "Errors").
const TYPED_RULES = {
  // A promise nobody waits for fails silently: its rejection reaches only
  // the console, where nobody looks. One that's meant to run on its own says
  // so with `void`.
  "@typescript-eslint/no-floating-promises": "error",
};

// The backup is a package of its own (backup/README.md), with its own way of
// saying what went wrong, so these leave it out.
const TYPED_SITE_RULES = {
  // A promise handed to something that takes none, such as a timer, fails
  // as silently as one nobody waits for. Not event handlers and other
  // props, most of which are functions that catch what they throw.
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  // A switch over a set of codes handles every one, or says with a default
  // that the rest are alike, so a new code fails here at each place that
  // must decide what to do about it.
  "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
  // What's thrown, or rejected with, is an Error, so whatever catches it has
  // a message, a stack and a cause; and what a .catch() is handed is unknown
  // until it's checked, as a catch block's is.
  "@typescript-eslint/only-throw-error": "error",
  "@typescript-eslint/prefer-promise-reject-errors": "error",
  "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
  // An error put into a sentence as it is loses its cause, and an object
  // becomes "[object Object]": describeError() says an error in words.
  "@typescript-eslint/restrict-template-expressions": "error",
};

/** Every rule that needs the types, off: for linting made-up files, which have none. */
export const TYPED_RULES_OFF = Object.fromEntries(
  Object.keys({ ...TYPED_RULES, ...TYPED_SITE_RULES }).map((rule) => [rule, "off"]),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": ["error", DATABASE_URL_RULE, ...EXTERNAL_LINK_RULES],
      "no-restricted-imports": [
        "error",
        { paths: [PG_IMPORT], patterns: [POSTMARK_IMPORT, GMAIL_IMPORT, OUTSIDE_FETCH_IMPORT] },
      ],
    },
  },
  // Tests keep to the schema. Component tests link to example.org to exercise
  // a component, not to send anyone there. Only .tsx has JSX, so .ts tests
  // keep the link rules.
  {
    files: ["**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", DATABASE_URL_RULE, ...EXTERNAL_LINK_RULES, ...SCHEMA_CHANGE_RULES] },
  },
  { files: ["**/*.test.tsx"], rules: { "no-restricted-syntax": ["error", DATABASE_URL_RULE, ...SCHEMA_CHANGE_RULES] } },
  // The tests whose subject is a schema, not the site's: the backup's, which
  // fill throwaway databases to back up; the migration runner's check, which
  // makes the ledger it reads; and the checks on migration files and the
  // schema's dump, whose SQL is only text. lib/server/db.server.test.ts, the
  // runner's own, has every rule off, below.
  {
    files: [
      "backup/container/*.test.ts",
      "lib/server/migrations-check.server.test.ts",
      "netlify/database/schema.test.ts",
      "scripts/migrations-unchanged.test.ts",
    ],
    rules: { "no-restricted-syntax": ["error", DATABASE_URL_RULE, ...EXTERNAL_LINK_RULES] },
  },
  // The storyboard's flows and their steps, which open bubbles with openBubble.
  {
    files: ["tests/storyboard/**/*.ts"],
    ignores: ["tests/storyboard/settle.ts", "tests/storyboard/frame.ts", "**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        DATABASE_URL_RULE,
        ...EXTERNAL_LINK_RULES,
        ...OPEN_BUBBLE_RULES,
        CARET_KEYS_RULE,
        RELOAD_RULE,
      ],
    },
  },
  // The editor's steps, which press those keys and wait for the caret.
  {
    files: ["tests/storyboard/editor-steps.ts"],
    rules: {
      "no-restricted-syntax": ["error", DATABASE_URL_RULE, ...EXTERNAL_LINK_RULES, ...OPEN_BUBBLE_RULES, RELOAD_RULE],
    },
  },
  // The bindings' tests, which call outsideFetch and Postmark's binding directly.
  { files: [`${OUTSIDE}/**/*.test.ts`], rules: { "no-restricted-imports": ["error", { paths: [PG_IMPORT] }] } },
  // The database's one connection, the test helper that gives each test
  // file its own database, and the scripts that make the local ones.
  {
    files: [
      "lib/server/db.server.ts",
      "lib/server/db.server.test.ts",
      "tests/database.ts",
      "scripts/db-migrate.mjs",
      "scripts/db-reset.mjs",
      "scripts/serve-fixture.mjs",
      "scripts/serve-main.mjs",
      "scripts/serve.mjs",
    ],
    rules: { "no-restricted-imports": "off", "no-restricted-syntax": "off" },
  },
  // The site's own code, not its tests. A later block's list replaces an
  // earlier one's, so each file allowed one of these things comes after.
  ...[
    { files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "proxy.ts"] },
    // The server's clock runs in the browser too, where config can't go.
    { files: ["lib/now.ts"], env: true },
    // The browser's one way to ask the site's routes, and its telling the site of an error, which outlives the page.
    { files: ["lib/ask-server.ts", "lib/browser-errors.ts"], fetch: true },
    { files: ["app/(staff)/**/*.tsx"], staff: true },
    // The gallery's example of a Server Action the site no longer has, which it asks for by hand.
    { files: ["app/(staff)/staff/_components/shell/SiteUpdated.gallery.client.tsx"], fetch: true, staff: true },
    // The hook itself, whose transition is the one the rest go through.
    { files: ["components/ui/useSave.ts"], asyncHandlers: true },
    // The server's code: lib/server/, each feature's logic, and what answers a request.
    {
      files: [
        "lib/server/**/*.ts",
        ...featureLibFolders().map((folder) => `${folder}/**/*.ts`),
        "app/**/route.ts",
        "app/**/actions.ts",
      ],
    },
    // The fakes read the fixture build's own settings, as the storyboard loads them outside the site.
    { files: ["lib/server/fixtures/*.ts", "lib/server/fixtures/fakes/*.ts"], fakes: true, env: true },
    { files: ["lib/server/config.server.ts"], env: true, siteUrl: true },
    { files: [`${OUTSIDE}/*.ts`], outsideFetch: true, binding: true },
    ...SERVICES.map((service) => ({ files: service.files, service, outsideFetch: true, binding: true })),
    { files: [`${OUTSIDE}/outside-fetch.server.ts`], fetch: true, binding: true },
    // What the provider said of a send that failed, which the letter's or copy's own record keeps for its page.
    { files: ["lib/email/email.server.ts"], sendEmail: true, describeError: true },
    // The Errors page's record of an error, and why a mailbox couldn't be read, in the run's own account of it.
    { files: ["lib/oversight/errors-seen.server.ts", "lib/jobs/gmail-reading.server.ts"], describeError: true },
    { files: ["lib/site-url.server.ts"], siteUrl: true },
    { files: ["lib/server/db.server.ts"], database: true },
    { files: ["lib/server/problems.server.ts"], console: true },
  ].map(({ files, ...allowed }) => ({ files, ignores: ["**/*.test.{ts,tsx}"], rules: siteCodeRules(allowed) })),
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", ...UNCONVERTED_DOM_EDITS],
    rules: { "no-restricted-properties": ["error", ...DIRECT_DOM_EDITS] },
  },
  ...importRules(LAYERS),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: TYPED_RULES,
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["backup/**"],
    rules: {
      ...TYPED_SITE_RULES,
      // An error thrown in place of one caught names it as its cause.
      "preserve-caught-error": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-serve/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test output and local scratch files.
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    ".vitest/**",
    "tmp/**",
    "blob-report/**",
    // Agents' worktrees: whole checkouts of other branches.
    ".claude/**",
    // Netlify's build folder: its plugins, and the Deno and Node code they
    // bring with them. It's there during a Netlify build, which lints.
    ".netlify/**",
  ]),
]);

export default eslintConfig;
