import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { messageContent } from "./threads.server";
import { saveLetterReply } from "@/lib/server/outside-services/blobs.server";

describeWithDatabase("letter threads", () => {
  useTestDatabase();
  beforeEach(() => vi.stubEnv("DATA_FIXTURES", "1"));
  afterEach(() => vi.unstubAllEnvs());

  it("folds the mail a reply quotes, in plain text or in an HTML blockquote", async () => {
    await saveLetterReply(
      "plain.eml.gz",
      gzipSync(
        "Subject: Re\r\nCc: =?utf-8?Q?Casey_W=C3=B6rker?= <casey@parliament.uk>\r\n\r\nYes.\r\n\r\nOn Mon, Jo wrote:\r\n> Will you?\r\n",
      ),
    );
    // Its Cc as it came, its encoded words decoded.
    expect(await messageContent("plain.eml.gz")).toEqual({
      text: "Yes.",
      quoted: "On Mon, Jo wrote:\n> Will you?",
      cc: "Casey Wörker <casey@parliament.uk>",
      auto: false,
      whole: "Yes.\n\nOn Mon, Jo wrote:\n> Will you?",
    });
    await saveLetterReply(
      "html.eml.gz",
      gzipSync(
        "Content-Type: text/html\r\n\r\n<div>No.</div><div>On Mon, Jo wrote:<br></div>" +
          "<blockquote>Will you?<blockquote>Older</blockquote></blockquote>",
      ),
    );
    expect(await messageContent("html.eml.gz")).toMatchObject({ text: "No.", cc: null });
    expect((await messageContent("html.eml.gz")).quoted).toContain("> Will you?");
  });

  it("says a machine sent a message, by its headers or its subject, however encoded", async () => {
    const saved = async (key: string, headers: string) => {
      await saveLetterReply(key, gzipSync(`${headers}\r\n\r\nAway.\r\n`));
      return (await messageContent(key)).auto;
    };
    expect(await saved("header.eml.gz", "Subject: Your letter\r\nAuto-Submitted: auto-replied")).toBe(true);
    expect(await saved("subject.eml.gz", "Subject: =?utf-8?Q?Automatic_reply=3A_Hello?=")).toBe(true);
    expect(await saved("person.eml.gz", "Subject: Re: Hello")).toBe(false);
    expect(await saved("nosubject.eml.gz", "From: jo@example.com")).toBe(false);
  });

  it("reads HTML as its paragraphs and characters, not its source's layout", async () => {
    await saveLetterReply(
      "layout.eml.gz",
      gzipSync(
        "Content-Type: text/html\r\n\r\n<html><head><title>Not this</title></head><body><!-- nor this -->" +
          "<p>Dear&nbsp;Jo,</p>\r\n<p>It&rsquo;s\r\nsplit in the source &amp; &#8211; &#x2014; &unknown;.</p>" +
          "<div>A line</div><div><br></div><div>Another<br>line</div><ul><li>First</li><li>Second</li></ul></body></html>",
      ),
    );
    expect((await messageContent("layout.eml.gz")).text).toBe(
      "Dear\u00a0Jo,\n\nIt’s split in the source & – — &unknown;.\n\nA line\n\nAnother\nline\n\n- First\n- Second",
    );
  });
});
