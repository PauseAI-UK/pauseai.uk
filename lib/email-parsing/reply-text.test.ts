import { describe, expect, it } from "vitest";
import { letterText, replyParts } from "./reply-text";

const replyText = (text: string) => replyParts(text).text;

describe("replyText", () => {
  it("keeps a message that quotes nothing whole, even one ending “wrote:”", () => {
    expect(replyText("Thanks.\n\nPolly")).toBe("Thanks.\n\nPolly");
    expect(replyText("Here is what my colleague wrote:")).toBe("Here is what my colleague wrote:");
  });

  it("leaves out the quote at the foot of a reply, and the “On … wrote:” over it, wrapped or not", () => {
    expect(
      replyText(
        "Thanks.\n\nPolly\n\nOn Wed, 29 Oct 2026 at 14:18, Jo <jo@pauseai.uk> wrote:\n> Dear Polly,\n>\n> Will you?\n",
      ),
    ).toBe("Thanks.\n\nPolly");
    expect(replyText("Yes.\n\nOn Wed, 29 Oct 2026 at 14:18, Jo <\njo@pauseai.uk> wrote:\n\n> Dear Polly,")).toBe(
      "Yes.",
    );
    expect(replyText("Yes.\n\nJo Bloggs <jo@pauseai.uk>\nwrote:\n> Dear Polly,")).toBe(
      "Yes.\n\nJo Bloggs <jo@pauseai.uk>",
    );
    expect(replyText("Yes.\n> Dear Polly,")).toBe("Yes.");
  });

  it("leaves out Gmail's quote of a mailing sent through a Google Group, its footer and all", () => {
    const reply = [
      "Thanks Francis, I would love to!",
      "",
      "I will get right to it!!!",
      "",
      "On Thu, Oct 29, 2026 at 2:18 PM PauseAI UK Policy <policy@pauseai.uk> wrote:",
      "",
      "> Dear Mx McTestface,",
      ">",
      "> I think the Millennium Dome looks exactly the same shape as a giant pause",
      "> button would look. I have an architect who has done up plans to paint it",
      "> orange and make the pillar things into two long black marks so from the air",
      "> when people fly into London City it looks like a massive fuck-off pause",
      "> button.",
      ">",
      "> Given the Government's policy is now entirely about stopping everyone",
      "> being killed by out of control AI, could you please secure the funding",
      "> needed for this importing",
      ">",
      "> With love,",
      ">",
      "> Francis",
      ">",
      "> --",
      "> You received this message because you are subscribed to the Google Groups",
      '> "Test" group.',
      "> To unsubscribe from this group and stop receiving emails from it, send an",
      "> email to test+unsubscribe@pauseai.uk.",
      "> To view this discussion visit",
      "> https://groups.google.com/a/pauseai.uk/d/msgid/test/CAGt2EoG-N-eUZkjpmDFdYPCGdRgX1-7rEEqVkpNTah5zD_Z8KA%40mail.gmail.com",
      "> <https://groups.google.com/a/pauseai.uk/d/msgid/test/CAGt2EoG-N-eUZkjpmDFdYPCGdRgX1-7rEEqVkpNTah5zD_Z8KA%40mail.gmail.com?utm_medium=email&utm_source=footer>",
      "> .",
      "> For more options, visit https://groups.google.com/a/pauseai.uk/d/optout.",
      ">",
      "",
    ].join("\n");
    expect(replyText(reply)).toBe("Thanks Francis, I would love to!\n\nI will get right to it!!!");
  });

  it("leaves out an unmarked quote from its header down: Outlook's, its underscores, or Original Message", () => {
    const outlook =
      "Noted.\n\nFrom: Jo <jo@pauseai.uk>\nSent: 29 October 2026 14:18\nTo: Polly\nSubject: AI\n\nDear Polly,";
    expect(replyText(outlook)).toBe("Noted.");
    expect(replyText("Noted.\n*From:* Jo\n*To:* Polly\n*Date:* Today\n\nDear Polly,")).toBe("Noted.");
    expect(replyText("Noted.\n________________________________\nDear Polly,")).toBe("Noted.");
    expect(replyText("Noted.\n-----Original Message-----\nDear Polly,")).toBe("Noted.");
    expect(replyText("From: Polly's office\nWe'll reply soon.")).toBe("From: Polly's office\nWe'll reply soon.");
  });

  it("keeps the quotes a reply answers in between, but not the quote at its foot", () => {
    expect(
      replyText(
        "On Mon, Jo wrote:\n> Will you fund it?\nNo.\n\n> Will you meet us?\nYes.\n\nPolly\n\n> With love,\n> Jo",
      ),
    ).toBe("On Mon, Jo wrote:\n> Will you fund it?\nNo.\n\n> Will you meet us?\nYes.\n\nPolly");
    expect(replyText("> From: Jo\n> Sent: Today\nAnswered.")).toBe("> From: Jo\n> Sent: Today\nAnswered.");
  });

  it("keeps the whole of a message that is nothing but a quote", () => {
    expect(replyText("> Will you?\n> Please.")).toBe("> Will you?\n> Please.");
    expect(replyText("-----Original Message-----\nDear Polly,")).toBe("-----Original Message-----\nDear Polly,");
  });

  it("keeps what it folds, the quote or footer below what the message says", () => {
    expect(replyParts("Yes.\n\nOn 5 Jun 2026, Jo wrote:\n> Will you?")).toEqual({
      text: "Yes.",
      quoted: "On 5 Jun 2026, Jo wrote:\n> Will you?",
    });
    expect(replyParts("Thanks.")).toEqual({ text: "Thanks.", quoted: "" });
    expect(replyParts("Sent from my iPhone")).toEqual({ text: "Sent from my iPhone", quoted: "" });
  });

  it("folds a forward, an unmarked “On … wrote:” and the Senedd's Welsh", () => {
    expect(replyText("See below.\n---------- Forwarded message ---------\nFrom: Jo")).toBe("See below.");
    expect(replyText("See below.\nBegin forwarded message:\nFrom: Jo")).toBe("See below.");
    expect(replyText("Yes.\nOn 5 Jun 2026, at 14:03, Jo\nBloggs wrote:\n\nDear Polly,")).toBe("Yes.");
    expect(replyText("Diolch.\nOddi wrth: Jo\nAnfonwyd: Heddiw\nAnnwyl Polly,")).toBe("Diolch.");
    expect(replyText("Diolch.\n\nAr 5 Meh 2026, ysgrifennodd Jo:\n> Annwyl Polly,")).toBe(
      "Diolch.\n\nAr 5 Meh 2026, ysgrifennodd Jo:",
    );
    expect(replyText("Diolch.\n\nAr 5 Meh 2026, 14:03 ysgrifennodd:\nAnnwyl Polly,")).toBe("Diolch.");
  });

  it("keeps an “On …” line of the message's own, one with no date, or with nothing or quotes under it", () => {
    const own = ["On Monday my colleague wrote:", "Please call me."].join("\n");
    expect(replyText(own)).toBe(own);
    expect(replyText("On reflection, yes.\nThanks.")).toBe("On reflection, yes.\nThanks.");
    expect(replyText("Yes.\nOn 5 Jun 2026 Jo wrote:")).toBe("Yes.\nOn 5 Jun 2026 Jo wrote:");
    expect(replyText("On 5 Jun 2026, Jo wrote:\n> Will you?\nYes.")).toBe(
      "On 5 Jun 2026, Jo wrote:\n> Will you?\nYes.",
    );
  });

  it("folds the footers mailers and parliaments add", () => {
    for (const footer of [
      "UK Parliament Disclaimer: This e-mail is confidential to the intended recipient.",
      "Sent from my iPhone",
      "Get Outlook for iOS",
      "DISCLAIMER: Views are the sender's.",
      "This email and any attachments are confidential.",
    ]) {
      expect(replyParts(`Thanks.\n\n${footer}`)).toEqual({ text: "Thanks.", quoted: footer });
    }
    expect(replyText("This email is about your letter.\nThanks.")).toBe("This email is about your letter.\nThanks.");
  });

  it("folds the footer a Google Group adds, from its line of “--”, but keeps a “--” over anything else", () => {
    const footer = [
      "--",
      'You received this message because you are subscribed to the Google Groups "PauseAI UK" group.',
      "To unsubscribe from this group and stop receiving emails from it, send an email to policy+unsubscribe@pauseai.uk.",
      "For more options, visit https://groups.google.com/a/pauseai.uk/d/optout.",
    ].join("\n");
    expect(replyParts(`Thanks.\n\n${footer}`)).toEqual({ text: "Thanks.", quoted: footer });
    expect(replyText("Thanks.\n\n--\nJo Bloggs MP")).toBe("Thanks.\n\n--\nJo Bloggs MP");
    expect(replyText("Thanks.\n\n--")).toBe("Thanks.\n\n--");
  });

  it("folds a politician's signature, from their name or title over their role, down", () => {
    const signature = [
      "Polly Placeholder MP",
      "Member of Parliament for Testshire North",
      "Pronouns: She/Her",
      "",
      "House of Commons, London, SW1A 1AA",
      "T: 020 7946 0000 | W: www.example.org",
    ].join("\n");
    expect(replyParts(`Thank you for your email.\n\nBest wishes,\n${signature}`)).toEqual({
      text: "Thank you for your email.\n\nBest wishes,",
      quoted: signature,
    });
    // A blank line between each, up to three lines of names and titles, in bold, as HTML mail comes.
    expect(
      replyText(
        "Thanks.\n\nKind regards\n\nSam Example\n\nChief of Staff\n\n*Office of Polly Placeholder MSP*\n\n*Member of the Scottish Parliament for Testshire*",
      ),
    ).toBe("Thanks.\n\nKind regards");
    for (const role of [
      "MP for Testshire",
      "MSP for Testshire",
      "Member of the Senedd for Testshire",
      "MLA for Testshire",
    ]) {
      expect(replyText(`Thanks.\n\nPolly Placeholder\n${role}`)).toBe("Thanks.");
    }
  });

  it("folds a member of staff's signature by their title, and PauseAI's own, keeping a first name signed over it", () => {
    expect(
      replyText("Thanks.\n\nBest wishes,\nSam\n\nSam Example\nSenior Parliamentary Assistant\nHouse of Commons"),
    ).toBe("Thanks.\n\nBest wishes,\nSam");
    for (const title of [
      "*Office of Polly Placeholder MP*",
      "*Sam Example | Office Manager*",
      "Sam Example ~ Caseworker",
      "PA to Lord Example",
      "Researcher",
    ]) {
      expect(replyParts(`Thanks.\n\n${title}\n020 7946 0000`)).toEqual({
        text: "Thanks.",
        quoted: `${title}\n020 7946 0000`,
      });
    }
    expect(replyText("See you then.\n\nJoseph\n\nJoseph Miller\nDirector, PauseAI UK\n1 Example Street")).toBe(
      "See you then.\n\nJoseph",
    );
    // Under a party, too.
    expect(replyText("Thanks.\n\nSam Example\nScottish Labour Member of Parliament for Testshire")).toBe("Thanks.");
  });

  it("keeps a title or role in what a message says: a sentence, a list's item, or lower case", () => {
    const intro =
      "I'm the UK Director of PauseAI, the world's largest movement\nfocused on preventing extreme AI risks.";
    expect(replyParts(`Dear Polly,\n\n${intro}`).quoted).toBe("");
    const list = "Our speakers:\n\n- Polly Placeholder MSP\n- Sam Example, AI Alignment Researcher";
    expect(replyText(`Hello.\n\n${list}`)).toBe(`Hello.\n\n${list}`);
    expect(replyParts("Thanks.\n\nPolly\nthe member of parliament for Testshire").quoted).toBe("");
  });

  it("folds data protection notices and a ruled line, and what comes under them", () => {
    for (const footer of [
      "Your personal information and what rights you have are in our privacy policy.",
      "*Privacy Policy: *https://example.org/privacy",
      "------------------------------\nsam.example@parliament.uk",
    ]) {
      expect(replyParts(`Thanks.\n\n${footer}`)).toEqual({ text: "Thanks.", quoted: footer });
    }
  });

  it("keeps a role that isn't under a name: in a sentence, ending one, under none, or too far below", () => {
    // Wrapped onto its own line, under the rest of its sentence.
    const sentence = "This invitation is for Polly in her capacity as\nMSP for Testshire South.";
    expect(replyText(`Thanks.\n\n${sentence}`)).toBe(`Thanks.\n\n${sentence}`);
    expect(replyText("Thanks.\n\nPolly\nMSP for Testshire South.")).toBe("Thanks.\n\nPolly\nMSP for Testshire South.");
    expect(replyText("Thanks.\n\nMember of Parliament for Testshire")).toBe(
      "Thanks.\n\nMember of Parliament for Testshire",
    );
    // Two blank lines, or four lines over it, aren't a signature.
    expect(replyText("Thanks.\n\nPolly Placeholder\n\n\nMP for Testshire")).toBe(
      "Thanks.\n\nPolly Placeholder\n\n\nMP for Testshire",
    );
    expect(replyText("Thanks.\n\nA\nB\nC\nD\nMP for Testshire")).toBe("Thanks.\n\nA\nB\nC\nD\nMP for Testshire");
    // A long line over it, or nothing after the names, isn't either.
    const long = "Polly Placeholder, who has represented Testshire for many years and more";
    expect(replyParts(`Thanks.\n\n${long}\nMP for Testshire`).quoted).toBe("");
    expect(replyText("Thanks.\n\nPolly Placeholder")).toBe("Thanks.\n\nPolly Placeholder");
    // A sign-off is never where it starts.
    expect(replyText("Thanks.\n\nKind regards\nMP for Testshire")).toBe("Thanks.\n\nKind regards\nMP for Testshire");
  });

  it("undoes a mailer's wrapping, leaving lines their writer ended", () => {
    const wrapped = [
      "I am very glad to have received your letter about the safety of",
      "advanced AI and I would like to meet you when the House next sits",
      "if that suits.",
    ].join("\n");
    expect(replyText(wrapped)).toBe(wrapped.replaceAll("\n", " "));
    const sentences = ["This line ends with a sentence of its own, as its writer meant it.", "So does this."].join(
      "\n",
    );
    expect(replyText(sentences)).toBe(sentences);
    const list = ["These are the points that I would most like to raise with you all", "- First", "- Second"].join(
      "\n",
    );
    expect(replyText(list)).toBe(list);
    const signature = ["Yours sincerely,", "Polly Placeholder MP", "Member of Parliament"].join("\n");
    expect(replyText(signature)).toBe(signature);
    const longLines = `${"A line longer than a mailer would ever wrap at, ".repeat(3)}\nand another`;
    expect(replyText(longLines)).toBe(longLines);
    const roomy = [
      "A short line with room in it",
      "here",
      "and one much wider than either of those two lines above it was",
    ].join("\n");
    expect(replyText(roomy)).toBe(roomy);
    expect(replyText("First paragraph.\n\nSecond paragraph.")).toBe("First paragraph.\n\nSecond paragraph.");
  });
});

describe("letterText", () => {
  it("takes off a mailer's quote marks and wrapping, keeping paragraphs and a link's bracket", () => {
    expect(
      letterText(
        [
          "Dear Ms Smith,",
          "",
          "I am very glad to be able to write to you about the safety of advanced",
          "AI models <https://example.org>",
          "",
          "Jo Bloggs",
          "> Director",
          ">",
          "> Example Street",
        ].join("\n"),
      ),
    ).toBe(
      "Dear Ms Smith,\n\nI am very glad to be able to write to you about the safety of advanced AI models <https://example.org>\n\nJo Bloggs\nDirector\n\nExample Street",
    );
  });
});
