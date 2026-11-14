// Every colour is a token in styles/tokens.css. An alpha is
// rgb(var(--x-rgb) / a), so rgb() itself is allowed with a variable and
// refused with numbers.
const RAW_COLOURS = { "/.*/": ["/\\b(rgb|hsl)a?\\(\\s*[\\d.]/"] };
// In the ui kit, spacing, type sizes and corners are tokens too
// (--space-*, --text-*, --radius-*, and the density's), so a component
// can't quietly ignore the density or drift off the scale.
const RAW_SIZES = { "/^(margin|padding|gap|row-gap|column-gap|font-size|border-radius)/": ["/\\d(px|rem)\\b/"] };
const MESSAGE = {
  message: "Colours, and in components/ui/ spacing, type sizes and corners, are tokens: use one from styles/tokens.css",
};

// The ui kit's stylesheets whose sizes aren't tokens yet. Take a file off
// this list when its sizes are; don't add to it.
const UNCONVERTED_UI_SIZES = [
  "components/ui/Button.module.css",
  "components/ui/ButtonRow.module.css",
  "components/ui/Closing.module.css",
  "components/ui/Foreword.module.css",
  "components/ui/IconButton.module.css",
  "components/ui/Lightbox.module.css",
  "components/ui/PageHero.module.css",
  "components/ui/PhotoCard.module.css",
  "components/ui/ProsePage.module.css",
  "components/ui/Section.module.css",
];

/** The CSS that may use vertical-align, as it lines its own things up and has been checked by eye. */
const VERTICAL_ALIGN_VETTED = [
  "app/(site)/_components/PressMarquee.module.css",
  "app/(staff)/staff/_components/jobs/ImportIcon.module.css",
  "app/(staff)/staff/_components/supporters/SignupUpload.module.css",
  "app/(staff)/staff/_components/StackedBars.module.css",
  "app/(staff)/staff/_components/StaffDashboard.module.css",
  "app/(staff)/staff/_components/supporters/SubscriptionBadges.module.css",
  "app/(staff)/staff/_components/shell/StaffNav.module.css",
  "app/(staff)/staff/_components/ui/IconText.module.css",
  "app/(staff)/staff/_components/ui/NotIcon.module.css",
  "app/(staff)/staff/_components/ui/Shortened.module.css",
  "components/briefings/BriefingText.module.css",
  "components/briefings/BudgetChart.module.css",
  "components/posts/PostBody.module.css",
  "components/ui/EditorIcons.module.css",
  "components/ui/Required.module.css",
  "components/ui/Table.module.css",
  "components/ui/Tag.module.css",
];

/** @type {import("stylelint").Config} */
const config = {
  // The rules that catch mistakes (unknown properties and values, duplicate
  // selectors, deprecated CSS), not style: Prettier does the formatting.
  extends: ["stylelint-config-recommended"],
  ignoreFiles: [
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    ".next/**",
    "public/**",
    // Netlify's build folder, with its plugins' own code. npm run build
    // runs this during a Netlify build.
    ".netlify/**",
  ],
  rules: {
    // Fires on almost every page's CSS where a hover or nested rule sits
    // above a plainer one. Reordering them all would risk changing how
    // pages look, for little gain.
    "no-descending-specificity": null,
    // CSS Modules' :global().
    "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global"] }],
    "color-no-hex": true,
    "color-named": "never",
    "declaration-property-value-disallowed-list": [RAW_COLOURS, MESSAGE],
    // Lining something up beside words goes wrong quietly: a nudge of a pixel
    // or two holds at one font size only, and one keyword everywhere is
    // right for some and wrong for others (middle centres on lowercase
    // letters, too low beside a heading's capitals). So vertical-align is
    // refused but in the files below that vet their own, each checked by eye
    // in the storyboard against main's frame. An icon before words is
    // IconText (app/(staff)/staff/_components/ui/IconText.tsx); anything as
    // tall as the line goes beside its words in a flex row, align-items
    // centring it (ui/Numbered.module.css). docs/style-guide.md, "Lining
    // something up with words".
    "property-disallowed-list": [
      ["vertical-align"],
      {
        message:
          'vertical-align lines things up by eye, so is kept to the vetted files in stylelint.config.mjs: put an icon before words in IconText, or lay it out beside them with align-items: center (docs/style-guide.md, "Lining something up with words")',
      },
    ],
    // Where it's allowed, a keyword, never a nudge by a length.
    "declaration-property-value-allowed-list": [
      { "vertical-align": ["top", "middle", "bottom", "baseline", "super", "sub", "text-top", "text-bottom"] },
      {
        message:
          "vertical-align by a length is a nudge that holds at one font size only: put an icon before words in IconText, or use a keyword",
      },
    ],
  },
  overrides: [
    {
      // The files that line something up with vertical-align, each checked against main's storyboard frames.
      files: VERTICAL_ALIGN_VETTED,
      rules: { "property-disallowed-list": null },
    },
    {
      files: ["components/ui/**/*.css"],
      rules: { "declaration-property-value-disallowed-list": [{ ...RAW_COLOURS, ...RAW_SIZES }, MESSAGE] },
    },
    {
      files: UNCONVERTED_UI_SIZES,
      rules: { "declaration-property-value-disallowed-list": [RAW_COLOURS, MESSAGE] },
    },
    {
      files: ["styles/tokens.css"],
      rules: {
        "color-no-hex": null,
        "color-named": null,
        "declaration-property-value-disallowed-list": null,
      },
    },
  ],
};

export default config;
