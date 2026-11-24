import type { Fake } from "../fake";
import controlaiLetter from "../controlai-letter.json";
import { CONTROLAI_STATEMENT_HTML } from "../politician-lists";

// ControlAI's statement page, its letter to the PM and the letter's PDF.

export const controlaiFake: Fake = ({ hostname, pathname }) => {
  if (hostname === "controlai.org" && pathname === "/statement") {
    return new Response(CONTROLAI_STATEMENT_HTML, { headers: { "Content-Type": "text/html" } });
  }
  // ControlAI's letter page, and its PDF: made by pdf-lib, naming the
  // fixture MPs, a peer, and names nobody has.
  if (hostname === "controlai.org" && pathname === "/uk-pm-letter") {
    return new Response(controlaiLetter.html, { headers: { "Content-Type": "text/html" } });
  }
  if (hostname === "images.controlai.com" && pathname.endsWith(".pdf")) {
    return new Response(Buffer.from(controlaiLetter.pdf, "base64"), { headers: { "Content-Type": "application/pdf" } });
  }
  return undefined;
};
