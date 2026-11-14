import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import MailEmail from "./MailEmail";
import { mailingsCopy } from "./copy";

/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("MailEmail", () => {
  it("shows who it's from and to where it's said, always its subject, then its body", async () => {
    const { rerender } = await render(
      <MailEmail from="jo@pauseai.uk" to="Each politician" subject="A subject">
        The letter
      </MailEmail>,
    );
    const terms = () => [...document.querySelectorAll("dt")].map((dt) => dt.textContent);
    const words = mailingsCopy.mailingPages;
    expect(terms()).toEqual([words.from, words.to, words.subject]);
    await says("The letter");
    await rerender(<MailEmail subject="A subject">The letter</MailEmail>);
    expect(terms()).toEqual([words.subject]);
  });
});
