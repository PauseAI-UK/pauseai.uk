import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { exampleGmailAccount } from "../LetterThread.examples";
import { accountsCopy } from "./copy";
import MyGmail from "./MyGmail";

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
