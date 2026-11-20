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

  /** A message in two forms, as a casework system sends it: its plain text made from its HTML. */
  const inTwoForms = (plain: string, html: string) =>
    parseMime(
      'Content-Type: multipart/alternative; boundary="b"\r\n\r\n' +
        `--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${plain}\r\n` +
        `--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n--b--\r\n`,
    );

  it("reads the HTML of a message whose plain text has HTML's entities left in it", () => {
    const tracked = "https://u1.ct.sendgrid.net/ls/click?upn=u001.abc-2Bdef";
    const html =
      "<div>Dear&nbsp;Jo,<br> <br> I&rsquo;ve signed the motion. It asks for: <ul style='margin: 0'> <li>a summit</li> " +
      `<li>a treaty.</li> </ul> <br> You can read it here:&nbsp;<a href="${tracked}">https://example.org/motion/1</a><br> <br> ` +
      "Best wishes,<br> &#8203;&#8203;&nbsp; Office of Sam Jones MP<br> Your data&#8239;is safe.</div>";
    const plain =
      "Dear&nbsp;Jo,\r\n\r\nI&rsquo;ve signed the motion. It asks for:\r\n\r\n\ta summit\r\n\ta treaty.\r\n\r\n\r\n" +
      `You can read it here:&nbsp;${tracked}\r\n\r\nBest wishes,\r\n&#8203;&#8203;&nbsp; Office of Sam Jones MP\r\n` +
      "Your data&#8239;is safe.";
    expect(wholeTextOf(inTwoForms(plain, html))).toBe(
      "Dear Jo,\n\nI’ve signed the motion. It asks for:\n- a summit\n- a treaty.\n\n" +
        "You can read it here: https://example.org/motion/1\n\nBest wishes,\n  Office of Sam Jones MP\n" +
        "Your data is safe.",
    );
  });

  it("reads plain text with nothing of HTML's in it, though the message has HTML too", () => {
    expect(wholeTextOf(inTwoForms("Jo & Sam; R&D; AT&T.", "<p>Not this</p>"))).toBe("Jo & Sam; R&D; AT&T.");
  });

  it("reads the entities in plain text that has them, when the message has no HTML", () => {
    const message = parseMime(
      "Content-Type: text/plain\r\n\r\nIt&rsquo;s &#163;5 &amp; &#x2014; &unknown; &#99999999; &#xffffffff;.&#8203;\r\n",
    );
    expect(wholeTextOf(message)).toBe("It’s £5 & — &unknown; &#99999999; &#xffffffff;.");
  });

  it("reads a message with no text as empty", () => {
    expect(wholeTextOf(parseMime("Content-Type: image/png\r\n\r\nabc"))).toBe("");
  });
});
