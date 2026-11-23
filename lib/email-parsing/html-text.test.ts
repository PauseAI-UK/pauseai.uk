import { describe, expect, it } from "vitest";
import { htmlText, linkAddress } from "./html-text";

describe("an HTML email's text", () => {
  it("writes Gmail's lines and paragraphs as plain text does, its entities as characters", () => {
    const html =
      '<div dir="ltr"><div>Dear&nbsp;Jo,</div><div><br></div><div>It&rsquo;s split\r\n in the source &amp; &#8211; &#x2014;.</div>' +
      "<div><br></div><div>Kind regards,<br>Sam</div></div>";
    expect(htmlText(html)).toBe("Dear Jo,\n\nIt’s split in the source & – —.\n\nKind regards,\nSam");
  });

  it("puts a blank line around a paragraph, a heading and a preformatted block, which keeps its lines", () => {
    expect(htmlText("<h1>News</h1>Before<p>One</p><p>Two</p><pre>a  b\nc</pre>After")).toBe(
      "News\n\nBefore\n\nOne\n\nTwo\n\na  b\nc\n\nAfter",
    );
  });

  it("writes Outlook's paragraphs without space between them, its empty ones as blank lines", () => {
    const html =
      '<p class="MsoNormal">Dear Jo,<o:p></o:p></p><p class="MsoNormal"><o:p>&nbsp;</o:p></p>' +
      '<p class="MsoNormal">Thank you.<o:p></o:p></p><p class="MsoNormal">Sam Jones<o:p></o:p></p>' +
      '<p class="MsoNormal" style="margin-bottom:12.0pt">Spaced under</p><p style="margin:0cm 0cm 0.0001pt">Tight</p>' +
      '<p style="margin: 12px">Spaced</p><p style="margin:auto">After</p>';
    expect(htmlText(html)).toBe("Dear Jo,\n\nThank you.\nSam Jones\nSpaced under\n\nTight\n\nSpaced\n\nAfter");
  });

  it("spaces Outlook's paragraphs as Outlook does: by Word's own margins, a line's worth and more only", () => {
    const html =
      '<p class="MsoNormal">Tight</p><p class="MsoNormal" style="mso-margin-top-alt:auto;mso-margin-bottom-alt:auto">Auto</p>' +
      '<p class="MsoNormal" style="mso-margin-top-alt:0cm;margin-bottom:6.0pt">Six points under</p>' +
      '<p class="MsoNormal" style="margin-bottom:.5cm">Half a centimetre</p><p class="MsoNormal" style="margin-bottom:1em">An em</p>' +
      '<p class="MsoNormal" style="margin-bottom:5%">Five per cent</p><p class="MsoNormal" style="margin-bottom:1ex">An ex</p>' +
      '<p class="MsoNormal">End</p>';
    expect(htmlText(html)).toBe(
      "Tight\n\nAuto\n\nSix points under\nHalf a centimetre\n\nAn em\n\nFive per cent\n\nAn ex\n\nEnd",
    );
  });

  it("spaces a block by the margins its style sets, as Outlook on the web's paragraphs, and none otherwise", () => {
    const html =
      '<div style="margin-top:1em;margin-bottom:1em">One</div><div style="margin:1em 0">Two</div>' +
      "<div>Three</div><div>Four</div><div style='margin-top:4px'>Five</div>";
    expect(htmlText(html)).toBe("One\n\nTwo\n\nThree\nFour\nFive");
  });

  it("keeps a blockquote that only indents, with no margin, tight to the lines round it, as Gmail's signature", () => {
    const indent = (words: string) =>
      `<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex">${words}</blockquote>`;
    expect(htmlText(`<div>Joseph</div><br>${indent("Joseph Miller")}${indent("Director")}<div>After</div>`)).toBe(
      "Joseph\n\nJoseph Miller\nDirector\nAfter",
    );
  });

  it("puts a blank line above a heading, a line all bold, after a sentence's end, but not under a signature's sign-off", () => {
    const html =
      '<p class="MsoNormal">It can be damaged.</p><p class="MsoNormal"><b>Catering</b></p><p class="MsoNormal">No food.</p>' +
      '<p class="MsoNormal">Kind regards,</p><p class="MsoNormal"><b>Sam Jones</b></p>' +
      '<p class="MsoNormal">Note:</p><p class="MsoNormal"><b>Not a heading.</b></p>';
    expect(htmlText(html)).toBe(
      "It can be damaged.\n\n*Catering*\nNo food.\nKind regards,\n*Sam Jones*\nNote:\n*Not a heading.*",
    );
  });

  it("leaves out what can't be seen: the head, styles, scripts, comments, hidden elements and invisible characters", () => {
    const html =
      "<html><head><title>Not this</title><style>p { color: red }</style></head><body><!-- nor this -->" +
      '<div style="display: none">Preview</div><span style="max-height:0px;overflow:hidden">Nor</span>' +
      '<div hidden>Hidden</div><div style="mso-hide:all">Outlook only</div><script>x()</script>' +
      "<p>Shown​<br><span>&#8203;</span>­</p></body></html>";
    expect(htmlText(html)).toBe("Shown");
  });

  it("writes a list's items each on a line, a dash or a number before it, a nested list indented", () => {
    const html =
      "<div>It asks for:</div><ul><li>a summit</li><li>a treaty<ol start='3'><li>first</li><li>then</li></ol></li></ul>" +
      "After the list.<li>Stray</li>";
    expect(htmlText(html)).toBe(
      "It asks for:\n\n- a summit\n- a treaty\n  3. first\n  4. then\n\nAfter the list.\n- Stray",
    );
    expect(htmlText('<div>Tight:</div><ul style="margin-top:0cm"><li>one</li></ul>')).toBe("Tight:\n- one");
  });

  it("writes Word's list marks as a dash or the number they are", () => {
    const item = (mark: string, words: string) =>
      `<p class="MsoListParagraph"><span style="font-family:Symbol"><span style="mso-list:Ignore">${mark}` +
      `<span style="font:7.0pt">&nbsp;&nbsp;&nbsp; </span></span></span>${words}</p>`;
    expect(htmlText(item("·", "Health") + item("2.", "Housing") + item("o", "Roads"))).toBe(
      "- Health\n2. Housing\n- Roads",
    );
  });

  it("writes a table's cells on a line, a space between", () => {
    expect(htmlText("<table><tr><td>Sam Jones</td><td></td><td>Office</td></tr><tr><td>0207</td></tr></table>")).toBe(
      "Sam Jones Office\n0207",
    );
  });

  it("marks bold words with asterisks and italic ones with underscores, outside their spaces, once however nested, on each line", () => {
    expect(htmlText("A <b>bold </b>word, <strong>very <b>bold</b></strong>, <b> </b><b>two<br>lines</b>.")).toBe(
      "A *bold* word, *very bold*, *two*\n*lines*.",
    );
    expect(htmlText("<b>*Starred*</b> <i>An <em>italic</em> title</i>, <i>snake_case</i>, <b><i>both</i></b>")).toBe(
      "*Starred* _An italic title_, snake_case, *_both_*",
    );
  });

  it("joins pieces in the same style written one after another, as Outlook writes an address", () => {
    expect(
      htmlText("<p><b>jo</b><b>.smith</b><a href='mailto:jo@example.com'><b>@example.com</b></a> | <b>0207</b></p>"),
    ).toBe("*jo.smith@example.com* | *0207*");
  });

  it("writes a link's address after its words, unless its words are a web address already", () => {
    const html =
      '<a href="https://example.org/motion">Read the motion</a>, <a href="https://example.org/a">https://example.org/a</a>, ' +
      '<a href="https://example.org/b">example.org/b</a>, <a href="https://www.example.org">www.example.org</a>, ' +
      '<a href="mailto:jo@example.com">jo@example.com</a>, <a href="tel:0207">0207</a>, <a href="https://example.org/c"></a>' +
      '<a name="anchor">named</a>, <a href="https://example.org/d">across<br>lines</a>, <a href="https://exa mple.org">bad</a>.';
    expect(htmlText(html)).toBe(
      "Read the motion <https://example.org/motion>, https://example.org/a, example.org/b, " +
        "www.example.org, jo@example.com, 0207, named, across\nlines, bad.",
    );
    expect(htmlText('<a href="https://example.org/b">example.org/c</a>')).toBe("example.org/c <https://example.org/b>");
  });

  it("marks with '> ' what a blockquote quotes: one under 'On … wrote:', a citation, or one starting with its headers", () => {
    const html =
      "<div>Yes.</div><div>On Mon, 1 Jun 2026, Jo &lt;jo@example.com&gt; wrote:<br></div>" +
      '<blockquote class="gmail_quote"><div>Will you?</div><div>On Sun, Sam wrote:</div><blockquote><p>First</p><p>Second</p></blockquote></blockquote>' +
      '<blockquote type="cite"><div>On 1 Jun 2026, at 12:46, Jo wrote:</div><div>Cited</div></blockquote>' +
      "<blockquote><b>From:</b> Jo<br><b>Sent:</b> Monday</blockquote>" +
      '<div class="gmail_quote"><div class="gmail_attr">Le lun. 1 juin 2026, Jo a écrit :<br></div>' +
      '<blockquote class="gmail_quote">Oui</blockquote></div>';
    expect(htmlText(html)).toBe(
      "Yes.\nOn Mon, 1 Jun 2026, Jo <jo@example.com> wrote:\n\n> Will you?\n> On Sun, Sam wrote:\n>\n> > First\n> >\n> > Second\n\n" +
        "> On 1 Jun 2026, at 12:46, Jo wrote:\n> Cited\n\n> *From:* Jo\n> *Sent:* Monday\n\nLe lun. 1 juin 2026, Jo a écrit :\n\n> Oui",
    );
  });

  it("leaves a blockquote that only sets words apart unmarked, as a signature or a quotation in a letter", () => {
    const html =
      '<p>Yours sincerely,<br>Jo</p><blockquote class="gmail_quote" style="border-left:1px solid #ccc"><p>Jo Smith<br>Director</p></blockquote>' +
      "<p>Our quote:</p><blockquote><p>Safety cannot be a secret.</p></blockquote>";
    expect(htmlText(html)).toBe(
      "Yours sincerely,\nJo\n\nJo Smith\nDirector\n\nOur quote:\n\nSafety cannot be a secret.",
    );
  });

  it("writes Outlook's rule as its plain text does over a quoted message's headers, and leaves out any other rule", () => {
    const html =
      '<div>Thanks.</div><hr style="display:inline-block;width:98%"><div id="divRplyFwdMsg"><b>From:</b>&nbsp;Jo<br><b>Sent:</b> Monday</div>' +
      "<div>Hello</div><hr><div>A footer</div><hr><hr>";
    expect(htmlText(html)).toBe(`Thanks.\n${"_".repeat(32)}\n*From:* Jo\n*Sent:* Monday\nHello\nA footer`);
  });

  it("reads HTML that breaks the rules, and HTML with no words", () => {
    expect(htmlText("<p>Open<div>Unclosed</span></b>")).toBe("Open\n\nUnclosed");
    expect(htmlText("")).toBe("");
    expect(htmlText("<div><br><br></div>")).toBe("");
    expect(htmlText("<div>Words</div><div><br></div><blockquote type='cite'><div><br></div></blockquote>")).toBe(
      "Words",
    );
  });
});

describe("a link's address", () => {
  it("is the address itself, for a web page", () => {
    expect(linkAddress(" https://example.org/a?b=c ")).toBe("https://example.org/a?b=c");
    expect(linkAddress("HTTP://Example.org")).toBe("http://example.org/");
  });

  it("is none for one that isn't to a web page, or isn't an address", () => {
    expect(linkAddress("mailto:jo@example.com")).toBeUndefined();
    expect(linkAddress("https://exa mple.org")).toBeUndefined();
    expect(linkAddress("#top")).toBeUndefined();
  });

  it("takes off a scanner's, a redirect's or a tracker's wrapper, however deep", () => {
    const target = "https://example.org/page?x=1";
    const safe = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(target)}&data=1`;
    expect(linkAddress(safe)).toBe(target);
    expect(linkAddress(`https://www.google.com/url?q=${encodeURIComponent(safe)}&sa=D`)).toBe(target);
    expect(linkAddress(`https://urldefense.com/v3/__${target}__;!!abc$`)).toBe(target);
    expect(linkAddress(`https://abc.r.eu-west-1.awstrack.me/L0/${encodeURIComponent(target)}/1/0102`)).toBe(target);
  });

  it("keeps a wrapper whose inner address isn't one", () => {
    expect(linkAddress("https://www.google.com/url?q=not-a-link")).toBe("https://www.google.com/url?q=not-a-link");
    expect(linkAddress("https://www.google.com/url?q=mailto:jo@example.com")).toBe(
      "https://www.google.com/url?q=mailto:jo@example.com",
    );
    expect(linkAddress("https://www.google.com/search?q=https://example.org")).toBe(
      "https://www.google.com/search?q=https://example.org",
    );
    expect(linkAddress("https://abc.awstrack.me/L0/")).toBe("https://abc.awstrack.me/L0/");
    expect(linkAddress("https://urldefense.com/v2/url")).toBe("https://urldefense.com/v2/url");
  });

  it("is none for a tracker that hides where it goes, a map search on a street address, or a wrapper badly encoded", () => {
    for (const href of [
      "https://u1.ct.sendgrid.net/ls/click?upn=abc",
      "https://x.click.mailersend.net/tl/cws/abc",
      "https://pauseai.us1.list-manage.com/track/click?u=1",
      "https://mandrillapp.com/track/click/1",
      "https://d1.hubspotlinks.com/Ctc/1",
      "https://www.google.com/maps/search/15+Richmond+Road",
      "https://google.co.uk/maps/search/London",
      "https://abc.awstrack.me/L0/https:%2F%2Fexample.org%E0%A4%A/1",
    ])
      expect(linkAddress(href), href).toBeUndefined();
  });

  it("keeps Google's own pages and maps that aren't a search", () => {
    expect(linkAddress("https://www.google.com/maps/place/London")).toBe("https://www.google.com/maps/place/London");
    expect(linkAddress("https://docs.google.com/document/d/1")).toBe("https://docs.google.com/document/d/1");
  });
});
