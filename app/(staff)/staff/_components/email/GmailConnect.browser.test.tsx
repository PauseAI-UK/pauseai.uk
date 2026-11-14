import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { emailCopy } from "./copy";
import { GmailConnect, GmailOutcome, SentToday } from "./GmailConnect";

const gmail = emailCopy.gmail;

describe("GmailConnect, SentToday and GmailOutcome", () => {
  it("says what connecting means, then links to Google's consent, coming back to the page", async () => {
    await render(<GmailConnect back="/staff/me" />);
    await expect.element(page.getByText(gmail.intro)).toBeVisible();
    for (const line of gmail.explain) await expect.element(page.getByRole("listitem").getByText(line)).toBeVisible();
    await expect.element(page.getByText(gmail.limit("1,800"))).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: gmail.connect }))
      .toHaveAttribute("href", "/staff/api/gmail/connect?back=%2Fstaff%2Fme");
  });

  it("for the letters inbox: what connecting it means for supporters' letters, and its own limit", async () => {
    await render(<GmailConnect back="/staff/me" lettersInbox />);
    await expect.element(page.getByText(gmail.intro)).not.toBeInTheDocument();
    for (const line of gmail.lettersInboxExplain) await expect.element(page.getByText(line)).toBeVisible();
    await expect.element(page.getByText(gmail.lettersInboxLimit("1,950"))).toBeVisible();
    await render(<SentToday sent={3} lettersInbox />);
    await expect.element(page.getByText(gmail.sentToday(3, "1,950"))).toBeVisible();
  });

  it("is pending from its click until the page shows again, as after the browser's Back", async () => {
    // Kept on this page, as Google's would replace the test's.
    const stay = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("click", stay);
    await render(<GmailConnect back="/staff/me" />);
    const link = page.getByRole("link", { name: gmail.connect });
    await expect.element(link).not.toHaveAttribute("aria-busy");
    await link.click();
    await expect.element(link).toHaveAttribute("aria-busy", "true");
    await expect.element(link).toHaveAttribute("aria-disabled", "true");
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    await expect.element(link).not.toHaveAttribute("aria-busy");
    document.removeEventListener("click", stay);
  });

  it("says how many of today's sends are gone", async () => {
    await render(<SentToday sent={12} />);
    await expect.element(page.getByText(gmail.sentToday(12, "1,800"))).toBeVisible();
  });

  it("says how connecting ended, green if it did, amber if refused, red for an error, and nothing for an outcome it doesn't know", async () => {
    const { rerender } = await render(<GmailOutcome outcome="connected" me="jo@pauseai.uk" />);
    await expect.element(page.getByRole("status")).toHaveTextContent(gmail.outcomes.connected);
    await rerender(<GmailOutcome outcome="connected" me="letters@pauseai.uk" lettersInbox />);
    await expect.element(page.getByRole("status")).toHaveTextContent(gmail.outcomes.connectedLettersInbox);
    await rerender(<GmailOutcome outcome="refused" me="letters@pauseai.uk" lettersInbox />);
    await expect.element(page.getByRole("status")).toHaveTextContent(gmail.outcomes.refused);
    await rerender(<GmailOutcome outcome="refused" me="jo@pauseai.uk" />);
    await expect.element(page.getByRole("status")).toHaveTextContent(gmail.outcomes.refused);
    await rerender(<GmailOutcome outcome="other-account" me="jo@pauseai.uk" />);
    await expect.element(page.getByRole("alert")).toHaveTextContent(gmail.otherAccount("jo@pauseai.uk"));
    await rerender(<GmailOutcome outcome="" me="jo@pauseai.uk" />);
    expect(page.getByRole("status").query()).toBeNull();
  });
});
