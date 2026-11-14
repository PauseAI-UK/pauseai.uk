// A WhatsApp text as a page, for the storyboard to picture (textFrame in
// tests/storyboard/whatsapp-steps.ts): the chat with our number, its name and
// picture at the top, and the text in a bubble with its footer and Stop
// button. A plain chat app, not WhatsApp's own look: it shows what the
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
  .button { box-sizing: border-box; width: min(85%, 100%); padding: 9px; border-radius: 8px; background: #fff; color: #027eb5; text-align: center; box-shadow: 0 1px 1px rgb(0 0 0 / 0.1); }
`;

/** What a text shows: its words, and a template's footer and button. */
export type TextShown = { words: string; footer?: string; button?: string };

/** The whole page: the chat with `from` (our name and number) and one text; `note` above it, such as that it went for approval. */
export function textView(from: { name: string; number: string }, text: TextShown, note?: string): string {
  const footer = text.footer ? `<p class="footer">${escape(text.footer)}</p>` : "";
  const button = text.button ? `<div class="button">↩ ${escape(text.button)}</div>` : "";
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
    `<title>${escape(from.name)}</title><style>${STYLE}</style></head>`,
    `<body><main class="chat"><header>${PICTURE}<div><strong>${escape(from.name)}</strong>`,
    `<small>${escape(from.number)}</small></div></header>`,
    note ? `<p class="note">${escape(note)}</p>` : "",
    `<div class="wall"><div class="bubble"><p class="words">${escape(text.words)}</p>${footer}</div>${button}</div>`,
    "</main></body></html>",
  ].join("");
}
