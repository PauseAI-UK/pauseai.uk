import { describe, expect, it } from "vitest";
import { doIUseEmail } from "@jsx-email/doiuse-email";
import { plainAsHtml } from "./plain-email-html";

/** A no-break space, which holds a kept space's place. */
const S = String.fromCharCode(0xa0);

describe("plainAsHtml", () => {
  it("makes a paragraph of each block of lines, with a break where a line ends", () => {
    expect(plainAsHtml("Dear Jane,\n\nYour letter has gone.\nThank you.\n\nPauseAI")).toBe(
      "<p>Dear Jane,</p>\n<p>Your letter has gone.<br>Thank you.</p>\n<p>PauseAI</p>",
    );
  });

  it("reads line ends however they're written", () => {
    expect(plainAsHtml("One\r\ntwo\r\n\r\nThree\rfour")).toBe("<p>One<br>two</p>\n<p>Three<br>four</p>");
  });

  it("leaves out blank lines around the words, and lines of only spaces between them", () => {
    expect(plainAsHtml("\nOne\n \t\n\n\nTwo  \n\n")).toBe("<p>One</p>\n<p>Two</p>");
    expect(plainAsHtml("  \n\nOne")).toBe("<p>One</p>");
    expect(plainAsHtml("")).toBe("");
    expect(plainAsHtml(" \n\n ")).toBe("");
  });

  it("escapes what HTML would read as its own", () => {
    expect(plainAsHtml('Fish & chips <b>now</b>, "quoted"')).toBe(
      "<p>Fish &amp; chips &lt;b&gt;now&lt;/b&gt;, &quot;quoted&quot;</p>",
    );
  });

  it("links each web address to itself, without what ends the sentence after it", () => {
    expect(
      plainAsHtml("Follow this link to sign in:\n\nhttps://pauseai.uk/staff/api/callback?token=a-b_c&next=1"),
    ).toBe(
      '<p>Follow this link to sign in:</p>\n<p><a href="https://pauseai.uk/staff/api/callback?token=a-b_c&amp;next=1">https://pauseai.uk/staff/api/callback?token=a-b_c&amp;next=1</a></p>',
    );
    expect(plainAsHtml("See https://pauseai.uk/join.")).toBe(
      '<p>See <a href="https://pauseai.uk/join">https://pauseai.uk/join</a>.</p>',
    );
  });

  it("links an address once when the text gives it twice, as Gmail's plain text does", () => {
    expect(plainAsHtml("Read https://a.example <https://a.example> first")).toBe(
      '<p>Read <a href="https://a.example">https://a.example</a> first</p>',
    );
  });

  it("makes words between asterisks bold, a link among them still a link", () => {
    expect(plainAsHtml("This is *very important* to me")).toBe("<p>This is <strong>very important</strong> to me</p>");
    expect(plainAsHtml("*See https://a.example now*")).toBe(
      '<p><strong>See <a href="https://a.example">https://a.example</a> now</strong></p>',
    );
  });

  it("keeps the spaces a line starts with, and all but the last of several together", () => {
    expect(plainAsHtml("Events:\n  - Talk\n\t- Walk\nOne.  Two   three")).toBe(
      `<p>Events:<br>${S}${S}- Talk<br>${S}${S}${S}${S}- Walk<br>One.${S} Two${S}${S} three</p>`,
    );
    expect(plainAsHtml("  Indented from the start")).toBe(`<p>${S}${S}Indented from the start</p>`);
  });

  it("leaves one space after a link as it is", () => {
    expect(plainAsHtml("See https://a.example for more")).toBe(
      '<p>See <a href="https://a.example">https://a.example</a> for more</p>',
    );
  });

  it('makes a bulleted list of lines that start "- ", with its links and bold', () => {
    expect(plainAsHtml("- Talk, at https://a.example\n- *Walk*\n\n- Only one")).toBe(
      '<ul><li>Talk, at <a href="https://a.example">https://a.example</a></li><li><strong>Walk</strong></li></ul>\n<ul><li>Only one</li></ul>',
    );
  });

  it("puts a line that leads into a list above it, and lines after a list below", () => {
    expect(plainAsHtml("As the owner, you:\n- Arrive early\n- Leave last")).toBe(
      "<p>As the owner, you:</p>\n<ul><li>Arrive early</li><li>Leave last</li></ul>",
    );
    expect(plainAsHtml("- One\n- Two\nThen these words,\nand these.\n- Three")).toBe(
      "<ul><li>One</li><li>Two</li></ul>\n<p>Then these words,<br>and these.</p>\n<ul><li>Three</li></ul>",
    );
  });

  it("keeps a line set in under an item as part of it", () => {
    expect(plainAsHtml("- A long item that\n  carries on\n\tand on\n- The next")).toBe(
      "<ul><li>A long item that<br>carries on<br>and on</li><li>The next</li></ul>",
    );
  });

  it("leaves a dash that starts no item as it is", () => {
    expect(plainAsHtml("-not an item\n5 - 3 is 2\n-")).toBe("<p>-not an item<br>5 - 3 is 2<br>-</p>");
  });
});

// Whether Gmail and Outlook can show it, from the Can I email tables
// (https://www.caniemail.com), as the letter's HTML is checked
// (lib/letters/format.test.ts).
describe("a plain email's HTML in Gmail and Outlook", () => {
  it("uses nothing they don't support", () => {
    const html = plainAsHtml(
      "Dear Jane,\n\n*Thank you* for writing.\n  See https://pauseai.uk/join for more.\n- One\n- Two",
    );
    const result = doIUseEmail(html, { emailClients: ["gmail.*", "outlook.*"] });
    expect(result.success).toBe(true);
    // Lists are only "partly" supported: an <ol>'s reversed attribute and an
    // <li>'s value, neither of which these have.
    expect(new Set(result.warnings.map((warning) => warning.replace(/ by `.*`$/, "")))).toEqual(
      new Set(["`<ul>, <ol> and <dl>` is only partially supported"]),
    );
  });
});
