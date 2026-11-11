import { describe, expect, it } from "vitest";
import { attachmentHeaders } from "./mailing-attachments";

describe("attachmentHeaders", () => {
  it("gives a PDF or a picture of pixels to open in the browser, as its own type, never sniffed or cached", () => {
    expect(attachmentHeaders({ filename: "Brief: Ünïcode.pdf", contentType: "application/pdf" })).toEqual({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename*=UTF-8''Brief%3A%20%C3%9Cn%C3%AFcode.pdf",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(attachmentHeaders({ filename: "photo", contentType: type })).toMatchObject({
        "Content-Type": type,
        "Content-Disposition": "inline; filename*=UTF-8''photo",
      });
    }
    // The type alone, however it was written.
    expect(attachmentHeaders({ filename: "a.png", contentType: " Image/PNG; charset=utf-8" })["Content-Type"]).toBe(
      "image/png",
    );
  });

  it("gives any other kind, which could carry script, as plain bytes to save", () => {
    for (const type of ["text/html", "image/svg+xml", "application/xhtml+xml", "text/plain", "", "application/pdfx"]) {
      expect(attachmentHeaders({ filename: "page.html", contentType: type })).toEqual({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename*=UTF-8''page.html",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
    }
  });
});
