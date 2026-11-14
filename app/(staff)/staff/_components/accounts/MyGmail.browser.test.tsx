import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { exampleGmailAccount } from "../letters/LetterThread.examples";
import { accountsCopy } from "./copy";
import MyGmail from "./MyGmail";
import { shellCopy } from "../shell/copy";

const gmail = accountsCopy.gmail;

describe("MyGmail", () => {
  it("connected: saying so in its heading, since when, today's sends, and Disconnect", async () => {
    const disconnect = vi.fn();
    await render(<MyGmail me="jo@pauseai.uk" account={exampleGmailAccount} outcome="" disconnect={disconnect} />);
    await expect.element(page.getByRole("heading", { level: 2, name: gmail.connectedTitle })).toBeVisible();
    await expect
      .element(page.getByText(gmail.connected("1 Oct 2026"), { exact: false }))
      .toHaveTextContent(`${gmail.connected("1 Oct 2026")} ${gmail.sentToday(120, "1,800")}`);
    await page.getByRole("button", { name: gmail.disconnect }).click();
    await expect.poll(() => disconnect.mock.calls.length).toBe(1);
  });

  it("not connected: what connecting means, and the button, coming back here", async () => {
    await render(<MyGmail me="jo@pauseai.uk" account={undefined} outcome="failed" disconnect={vi.fn()} />);
    await expect.element(page.getByRole("heading", { level: 2, name: gmail.title })).toBeVisible();
    await expect.element(page.getByRole("alert")).toHaveTextContent(gmail.outcomes.failed);
    await expect
      .element(page.getByRole("link", { name: gmail.connect }))
      .toHaveAttribute("href", "/staff/api/gmail/connect?back=%2Fstaff%2Fme");
  });

  it("the letters inbox's: headed as sending supporters' letters, connected or not, told so when it connects", async () => {
    const { rerender } = await render(
      <MyGmail me="letters@pauseai.uk" lettersInbox account={undefined} outcome="" disconnect={vi.fn()} />,
    );
    await expect.element(page.getByRole("heading", { level: 2, name: gmail.lettersInboxTitle })).toBeVisible();
    await rerender(
      <MyGmail
        me="letters@pauseai.uk"
        lettersInbox
        account={exampleGmailAccount}
        outcome="connected"
        disconnect={vi.fn()}
      />,
    );
    await expect.element(page.getByRole("heading", { level: 2, name: gmail.lettersInboxConnectedTitle })).toBeVisible();
    await expect.element(page.getByRole("status")).toHaveTextContent(gmail.outcomes.connectedLettersInbox);
  });
});

const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);
const NOW = "2026-11-05T09:00:00Z";

describe("MyGmail, on what's kept from your Gmail", () => {
  it("says when threads with politicians are kept from your Gmail", async () => {
    const account = { email: "jo@pauseai.uk", name: "Jo", connectedAt: new Date(NOW), sentToday: 0, remaining: 1800 };
    const props = { me: "jo@pauseai.uk", account, outcome: "", disconnect: () => {} };
    const { rerender } = await render(<MyGmail {...props} keepsThreads />);
    await says(accountsCopy.gmail.kept.before);
    await expect.element(link(accountsCopy.gmail.oneOffEmails)).toHaveAttribute("href", "/staff/emails?type=one-off");
    await rerender(<MyGmail {...props} />);
    expect(link(accountsCopy.gmail.oneOffEmails).query()).toBeNull();
    await says(accountsCopy.gmail.notKept.before);
    await expect.element(link(shellCopy.nav.mailings)).toHaveAttribute("href", "/staff/mailings");
    // hello@'s sends the broadcasts too.
    await rerender(<MyGmail {...props} me="hello@pauseai.uk" sendsBroadcasts />);
    await says(accountsCopy.gmail.notKeptBroadcasts.before);
    await expect.element(link(shellCopy.nav.broadcasts)).toHaveAttribute("href", "/staff/broadcasts");
    await rerender(<MyGmail {...props} lettersInbox />);
    expect(link(shellCopy.nav.mailings).query()).toBeNull();
  });
});
