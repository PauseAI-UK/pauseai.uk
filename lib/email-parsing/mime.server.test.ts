import { describe, expect, it } from "vitest";
import {
  allParts,
  decodeWords,
  firstOfType,
  fromAddress,
  headerParameter,
  messageIds,
  parseHeaders,
  parseMime,
  decodedText,
  readMessage,
  partText,
  wholeTextOf,
} from "./mime.server";

describe("reading a message", () => {
  it("decodes encoded words, B and Q, in any charset, joining neighbours", () => {
    expect(decodeWords("=?utf-8?Q?Caf=C3=A9_au_lait?= =?UTF8?B?w6k=?= ok")).toBe("Café au laité ok");
    expect(decodeWords("=?iso-8859-1?q?r=E9ponse?=")).toBe("réponse");
  });

  it("unfolds headers, keeps the first of a name, and skips lines that aren't headers", () => {
    const headers = parseHeaders("Subject: one\r\n two\r\nnot a header\r\nSubject: again\r\nX-Empty:");
    expect(headers.get("subject")).toBe("one two");
    expect(headers.get("x-empty")).toBe("");
    expect(headers.size).toBe(2);
  });

  it("finds a header's parameters, quoted or not", () => {
    expect(headerParameter('multipart/mixed; boundary="a b"', "boundary")).toBe("a b");
    expect(headerParameter("text/plain; charset=iso-8859-1", "charset")).toBe("iso-8859-1");
    expect(headerParameter("text/plain", "charset")).toBeUndefined();
    expect(headerParameter(undefined, "charset")).toBeUndefined();
  });

  it("decodes quoted-printable, with soft line breaks and an = that isn't an escape", () => {
    const part = parseMime(
      "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nCaf=C3=A9 =\r\nis =ZZ open",
    );
    expect(partText(part)).toBe("Café is =ZZ open");
  });

  it("reads bytes not valid in the charset they name a byte to a character, and those that are in it", () => {
    const cut = Buffer.from("Ms N\u00ed\u00a0Chuil\u00edn", "latin1");
    expect(decodedText(cut, "text/plain; charset=utf-8")).toBe("Ms N\u00ed\u00a0Chuil\u00edn");
    expect(decodedText(cut, undefined)).toBe("Ms N\u00ed\u00a0Chuil\u00edn");
    expect(decodedText(cut, "text/plain; charset=iso-8859-1")).toBe("Ms N\u00ed\u00a0Chuil\u00edn");
    expect(decodedText(Buffer.from("Caf\u00e9 \u2019"), "text/plain; charset=utf-8")).toBe("Caf\u00e9 \u2019");
    expect(decodedText(cut, "text/plain; charset=no-such-charset")).toBe("Ms N\u00ed\u00a0Chuil\u00edn");
  });

  it("reads a part with no body, and plain text with no type as text in its charset", () => {
    expect(parseMime("Subject: only headers").body.length).toBe(0);
    const plain = parseMime("Subject: hi\n\nHello");
    expect(partText(plain)).toBe("Hello");
    expect(firstOfType(plain, "text/plain")).toBe(plain);
  });

  it("reads text in a charset it doesn't know as UTF-8", () => {
    expect(partText(parseMime("Content-Type: text/plain; charset=x-unknown\r\n\r\nHello"))).toBe("Hello");
  });

  it("reads a message carried inside another, as a bounce carries the one that bounced", () => {
    const raw = [
      'Content-Type: multipart/report; boundary="b1"',
      "",
      "--b1",
      "Content-Type: text/plain",
      "",
      "It bounced.",
      "--b1",
      "Content-Type: message/rfc822",
      "",
      "Message-ID: <abc@pauseai.uk>",
      "Subject: AI safety",
      "",
      "Dear Ms Placeholder",
      "--b1--",
    ].join("\r\n");
    const parts = allParts(parseMime(raw));
    expect(parts).toHaveLength(4);
    expect(parts[3].headers.get("message-id")).toBe("<abc@pauseai.uk>");
  });

  it("lists the Message-IDs in a header, without their brackets", () => {
    expect(messageIds("<a@x> <b@y>\r\n <c@z>")).toEqual(["a@x", "b@y", "c@z"]);
    expect(messageIds(undefined)).toEqual([]);
  });

  it("reads the address and name in a From header", () => {
    expect(fromAddress("Polly <Polly@Example.org>")).toEqual({ address: "polly@example.org", name: "Polly" });
    expect(fromAddress("MAILER-DAEMON@googlemail.com")).toEqual({ address: "mailer-daemon@googlemail.com", name: "" });
    expect(fromAddress(undefined)).toEqual({ address: "", name: "" });
  });

  /** A message in two forms, its plain text made from its HTML. */
  const inTwoForms = (plain: string, html: string) =>
    parseMime(
      'Content-Type: multipart/alternative; boundary="b"\r\n\r\n' +
        `--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${plain}\r\n` +
        `--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n--b--\r\n`,
    );

  it("reads a message's HTML when it has any, as its writer and reader saw it, unwrapped", () => {
    const tracked = "https://u1.ct.sendgrid.net/ls/click?upn=u001.abc-2Bdef";
    const html =
      "<div>Dear&nbsp;Jo,<br> <br> I&rsquo;ve signed the motion. It asks for: <ul style='margin: 0'> <li>a summit</li> " +
      `<li>a treaty.</li> </ul> <br> You can read it <a href="${tracked}">here</a>.</div>`;
    // As a casework system's plain text is: its HTML with the tags taken out, and no more.
    const plain =
      "Dear&nbsp;Jo,\r\n\r\nI&rsquo;ve signed the motion. It asks for:\r\n\r\n\ta summit\r\n\ta treaty.\r\n\r\n\r\n" +
      `You can read it here [${tracked}].`;
    expect(readMessage(inTwoForms(plain, html))).toEqual({
      text: "Dear\u00a0Jo,\n\nI’ve signed the motion. It asks for:\n- a summit\n- a treaty.\n\nYou can read it here.",
      wrapped: false,
    });
    expect(wholeTextOf(inTwoForms("Not this", "<p>This</p>"))).toBe("This");
  });

  it("reads the HTML Apple Mail splits around an attachment as one", () => {
    const message = parseMime(
      'Content-Type: multipart/alternative; boundary="a"\r\n\r\n--a\r\nContent-Type: text/plain\r\n\r\nPlain\r\n' +
        '--a\r\nContent-Type: multipart/mixed; boundary="m"\r\n\r\n' +
        "--m\r\nContent-Type: text/html\r\n\r\n<div>Before</div>\r\n" +
        '--m\r\nContent-Type: application/pdf\r\nContent-Disposition: inline; filename="a.pdf"\r\n\r\nPDF\r\n' +
        "--m\r\nContent-Type: text/html\r\nContent-Disposition: attachment\r\n\r\n<div>Attached</div>\r\n" +
        "--m\r\nContent-Type: text/html\r\n\r\n<div>After</div>\r\n--m--\r\n--a--\r\n",
    );
    expect(wholeTextOf(message)).toBe("Before\nAfter");
    expect(wholeTextOf(parseMime("Content-Type: text/html\r\n\r\n<p>Alone</p>"))).toBe("Alone");
  });

  it("reads plain text as it is, wrapped, when there's no HTML", () => {
    expect(readMessage(parseMime("Subject: Hi\r\n\r\nNo type, so plain."))).toEqual({
      text: "No type, so plain.",
      wrapped: true,
    });
    expect(readMessage(parseMime("Content-Type: text/plain\r\n\r\nJo & Sam; R&D;\r\nAT&T.\r\n"))).toEqual({
      text: "Jo & Sam; R&D;\nAT&T.",
      wrapped: true,
    });
  });

  it("reads the entities in plain text that has them, when the message has no HTML", () => {
    const message = parseMime(
      "Content-Type: text/plain\r\n\r\nIt&rsquo;s &#163;5 &amp; &#x2014; &unknown; &#99999999; &#xffffffff;.&#8203;\r\n",
    );
    expect(wholeTextOf(message)).toBe("It’s £5 & — &unknown; &#99999999; &#xffffffff;.");
  });

  it("reads a message with no text as empty", () => {
    expect(wholeTextOf(parseMime("Content-Type: image/png\r\n\r\nabc"))).toBe("");
    expect(
      readMessage(
        parseMime(
          'Content-Type: multipart/mixed; boundary="m"\r\n\r\n--m\r\nContent-Type: image/png\r\n\r\nabc\r\n--m--\r\n',
        ),
      ),
    ).toEqual({ text: "", wrapped: true });
  });
});
