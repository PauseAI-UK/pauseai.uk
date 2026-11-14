import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Run from "./Run";
import { exampleRun } from "./RunList.examples";
import { HeldImportExample } from "./Run.gallery.client";
import { jobsCopy } from "./copy";
import { politiciansCopy } from "../politicians/copy";

/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);
// The examples' Server Actions are logged, not sent: pressing each adds its line to the event log.
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

describe("Run", () => {
  it("says in a Gmail read how many one-off emails it kept", async () => {
    const accounts = [{ account: "policy@pauseai.uk", replies: 0, autoReplies: 0, bounces: 0, oneOffs: 2 }];
    await render(<Run run={exampleRun("read-gmail", { accounts })} open />);
    await says(jobsCopy.gmailReading.oneOffs(2));
  });

  it("logs a held import's apply and discard, in its example", async () => {
    await render(<HeldImportExample />);
    await page.getByRole("button", { name: politiciansCopy.politicianImports.apply }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('decide({"id":"4","job":"import-parliament","decision":"apply"})');
    await page.getByRole("button", { name: politiciansCopy.politicianImports.discard }).click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('decide({"id":"4","job":"import-parliament","decision":"discard"})');
  });
});
