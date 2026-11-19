// The photos in the home page's scrolling hero, from public/images/front-page-hero-optimized/.
// [src, alt, intrinsic width, intrinsic height] — the dimensions give each
// photo its shape before it loads; actual display size is driven by the CSS
// (height: 100%; width: auto) on the track's images (HomeHero.module.css).
// Each has an AVIF copy beside it, which the hero serves where it can, and a
// colour in hero-photo-colours.json, which fills its place until it loads:
// after adding or changing a photo, run `npm run data:hero-photos` to make
// both.
export const HERO_PHOTOS: [string, string, number, number][] = [
  ["alistair-june-2025-protest.webp", "Alistair at the June 2025 London protest", 800, 450],
  ["alistair-reading.webp", "Alistair Reith at a PauseAI event", 800, 416],
  ["benifei-russell-panel.webp", "Benifei and Russell at the PauseCon Brussels panel", 800, 449],
  ["book-launch-joseph.webp", "Joseph at the PauseAI UK book launch", 800, 600],
  ["connor-leahy.webp", "Connor Leahy speaking at a PauseCon", 800, 908],
  ["deepmind-close-up.webp", "Protester outside Google DeepMind", 800, 450],
  ["june-2025-protest-closeup.webp", "June 2025 protest close-up", 800, 450],
  ["laiba-brussels.webp", "Laiba at PauseCon Brussels", 800, 606],
  ["letter-writing.webp", "PauseAI UK letter-writing session", 800, 837],
  ["london-june-2025-protest-group.webp", "London June 2025 protest group", 800, 360],
  ["maxime-speech-audience.webp", "Maxime delivering a speech to a London audience", 800, 282],
  ["pausecon-brussels-2026-panel.webp", "PauseCon Brussels 2026 panel", 800, 450],
  ["pausecon-brussels-discussion.webp", "PauseCon Brussels discussion", 800, 534],
  ["pausecon-london-2025-people-talking.webp", "PauseCon London 2025 discussion", 800, 533],
  ["pausecon-london-ella-workshop.webp", "Ella's workshop at PauseCon London", 800, 533],
  ["scott-wiener-on-screen.webp", "Scott Wiener on screen at a PauseAI event", 800, 450],
  ["stuart-russell-interview.webp", "Stuart Russell interview at PauseCon Brussels", 800, 534],
  ["westminster-hall.webp", "Westminster Hall event", 800, 448],
  ["parliament-group-landscape.webp", "PauseAI UK volunteers outside Parliament, June 2026", 800, 326],
  ["jeremy-corbyn.webp", "PauseAI UK board member David Wood with MP Jeremy Corbyn", 800, 507],

  [
    "parliament-conference-sep-2026-audience.webp",
    "A packed committee room at the PauseAI UK discussion in Parliament, September 2026",
    800,
    533,
  ],
  [
    "parliament-conference-sep-2026-speakers.webp",
    "Speakers and organisers at the PauseAI UK discussion in Parliament, September 2026",
    800,
    400,
  ],
  ["pausecon-london-sept-2026-group.webp", "Group photo of attendees at PauseCon London, September 2026", 800, 314],
  [
    "downing-street-sept-2026-banner.webp",
    "Protesters holding a PauseAI banner and placards on Whitehall, September 2026",
    800,
    535,
  ],
  [
    "downing-street-sept-2026-gates-crowd.webp",
    "PauseAI protesters with placards at the Downing Street gates, September 2026",
    800,
    534,
  ],
  [
    "edinburgh-nov-2026-audience.webp",
    "The audience at the PauseAI UK panel discussion in Edinburgh's Playfair Library, November 2026",
    800,
    533,
  ],
  [
    "edinburgh-nov-2026-panel.webp",
    "Panellists at the PauseAI UK panel discussion in Edinburgh, November 2026",
    800,
    533,
  ],
  [
    "edinburgh-nov-2026-group.webp",
    "Speakers, volunteers and guests behind a PauseAI banner in Edinburgh, November 2026",
    800,
    533,
  ],
  [
    "edinburgh-nov-2026-check-in.webp",
    "PauseAI UK volunteers checking in guests at the Edinburgh panel discussion, November 2026",
    800,
    533,
  ],
];
