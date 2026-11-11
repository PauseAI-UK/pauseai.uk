// How big a file a mailing can attach, for the page to check before it
// uploads and the server to refuse, from the same number; and how a file is
// given back to a browser.

/**
 * The largest file a mailing can attach: it comes in one Server Action's
 * request, which Next.js takes up to `bodySizeLimit` (next.config.ts), and
 * Netlify up to 6MB.
 */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/**
 * The kinds of file a browser is given to show: a PDF, and the pictures
 * that are only pixels. Showing one runs nothing of the file's. Any other
 * kind, such as a web page or an SVG picture, can carry script, which would
 * run as a page of the staff site, as whoever opened it.
 */
const SHOWN_IN_BROWSER = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * The headers a mailing's file goes to a browser with. Its type is what it
 * was attached as, which whoever attached it chose: a kind a browser can
 * show (SHOWN_IN_BROWSER) goes as that, to open or picture; any other goes
 * as a download of plain bytes, which a browser saves and never shows.
 */
export function attachmentHeaders(file: { filename: string; contentType: string }): Record<string, string> {
  const type = file.contentType.split(";")[0].trim().toLowerCase();
  const shown = SHOWN_IN_BROWSER.includes(type);
  return {
    "Content-Type": shown ? type : "application/octet-stream",
    "Content-Disposition": `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
