// A WhatsApp text as a page, for the storyboard to picture (textFrame in
// tests/storyboard/whatsapp-steps.ts): the chat with our number, its name and
// picture at the top, and the text in a bubble: its header, a map with its
// place's name and address under it or a picture, then its words and footer,
// and its buttons under it. A plain chat app, not WhatsApp's own look: it shows what the
// supporter gets, as email-view.ts does an email.

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Our picture on WhatsApp: PauseAI's pause symbol (public/images/logos/Pause-Symbol.svg), drawn small. */
const PICTURE = `<svg viewBox="0 0 616 616" width="40" height="40" aria-hidden="true"><circle cx="308" cy="308" r="308" fill="#FF9416"/><rect x="194" y="176" width="77" height="274" rx="2" fill="#fff"/><rect x="339" y="176" width="77" height="274" rx="2" fill="#fff"/></svg>`;

const STYLE = `
  body { margin: 0; background: #e4ddd3; color: #111b21; font: 15px/1.4 Arial, Helvetica, sans-serif; }
  .chat { max-width: 560px; margin: 0 auto; min-height: 100vh; background: #efeae2; }
  header { display: flex; gap: 12px; align-items: center; padding: 10px 16px; background: #f0f2f5; border-bottom: 1px solid #d1d7db; }
  header strong { display: block; }
  header small { color: #667781; }
  .note { margin: 12px 16px 0; padding: 6px 10px; border-radius: 8px; background: #fff8c5; color: #54656f; font-size: 13px; text-align: center; }
  .wall { display: grid; gap: 4px; justify-items: start; padding: 16px; }
  .bubble { max-width: 85%; padding: 8px 10px; border-radius: 0 8px 8px 8px; background: #fff; box-shadow: 0 1px 1px rgb(0 0 0 / 0.1); }
  .words { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .footer { margin: 6px 0 0; color: #667781; font-size: 13px; }
  .top { margin: -4px -6px 8px; border-radius: 6px; overflow: hidden; background: #f0f2f5; }
  .shape { display: grid; place-items: center; height: 120px; background: #dfe5e7; color: #54656f; font-size: 13px; }
  .place { padding: 6px 8px; }
  .place strong { display: block; }
  .place span { color: #667781; font-size: 13px; }
  .button { box-sizing: border-box; width: min(85%, 100%); padding: 9px; border-radius: 8px; background: #fff; color: #027eb5; text-align: center; box-shadow: 0 1px 1px rgb(0 0 0 / 0.1); }
`;

/**
 * What a text shows: its words, and a template's footer; its header, a map
 * of a place, with the place's name and address where they're known, or a
 * picture; and its buttons, a reply's or a link's.
 */
export type TextShown = {
  words: string;
  footer?: string;
  top?: { map: { name: string; address: string } } | { picture: string };
  buttons?: { text: string; url?: string }[];
};

/** The whole page: the chat with `from` (our name and number) and one text; `note` above it, such as that it went for approval. */
export function textView(from: { name: string; number: string }, text: TextShown, note?: string): string {
  const footer = text.footer ? `<p class="footer">${escape(text.footer)}</p>` : "";
  const top = !text.top
    ? ""
    : "map" in text.top
      ? `<div class="top"><div class="shape">Map</div><p class="place"><strong>${escape(text.top.map.name)}</strong><span>${escape(text.top.map.address)}</span></p></div>`
      : `<div class="top"><div class="shape">${escape(text.top.picture)}</div></div>`;
  const buttons = (text.buttons ?? [])
    .map((one) => `<div class="button">${one.url === undefined ? "↩" : "↗"} ${escape(one.text)}</div>`)
    .join("");
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
    `<title>${escape(from.name)}</title><style>${STYLE}</style></head>`,
    `<body><main class="chat"><header>${PICTURE}<div><strong>${escape(from.name)}</strong>`,
    `<small>${escape(from.number)}</small></div></header>`,
    note ? `<p class="note">${escape(note)}</p>` : "",
    `<div class="wall"><div class="bubble">${top}<p class="words">${escape(text.words)}</p>${footer}</div>${buttons}</div>`,
    "</main></body></html>",
  ].join("");
}
