import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffTime } from "@/lib/staff-time";
import { OneOffTable } from "./OneOffList";
import OneOffThreadView from "./OneOffThreadView";
import { exampleForwardThread, exampleHiddenOneOff, exampleOneOffThread, exampleOneOffs } from "./OneOffList.examples";
import { lettersCopy } from "./copy";

const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("the one-off emails", () => {
  it("on a person's page, lists each thread, whose it is and when, and hides what staff can't read", async () => {
    await render(
      <OneOffTable
        threads={[...exampleOneOffs, exampleHiddenOneOff, { ...exampleOneOffs[0], id: 3, subject: "", people: [] }]}
      />,
    );
    await says(staffTime(exampleOneOffs[0].latestAt));
    await says(exampleOneOffs[0].mailboxes!.join(", "));
    await says(exampleOneOffs[0].participants!.join(", "));
    const answers = [...document.querySelectorAll("tbody tr")].map((row) => row.querySelectorAll("td")[3].textContent);
    expect(answers.slice(0, 3)).toEqual([lettersCopy.oneOff.answers.yes, lettersCopy.oneOff.answers.no, "–"]);
    await expect.element(link(exampleOneOffs[0].subject!)).toHaveAttribute("href", "/staff/one-off/1");
    await says(lettersCopy.oneOff.noPolitician);
    await says(lettersCopy.oneOff.hidden);
    expect(link(lettersCopy.oneOff.hidden).query()).toBeNull();
    await expect.element(link(lettersCopy.oneOff.noSubject)).toBeVisible();
  });

  it("on a person's page, shows nothing with none", async () => {
    const { rerender } = await render(<OneOffTable threads={[]} />);
    expect(page.getByRole("heading").query()).toBeNull();
    await rerender(<OneOffTable threads={exampleOneOffs} />);
    await expect.element(page.getByRole("heading", { name: lettersCopy.oneOff.onPageTitle })).toBeVisible();
  });

  it("opens a thread's messages, and says when it can't", async () => {
    const { rerender } = await render(<OneOffThreadView thread={exampleOneOffThread} />);
    const title = page.getByRole("heading", { level: 1 });
    const facts = () => page.getByRole("banner").element().querySelector("p")!.textContent;
    await expect.element(title).toHaveTextContent("Thread between Joseph Example and Polly Placeholder");
    expect(facts()).toBe(
      [
        lettersCopy.oneOff.fact(lettersCopy.oneOff.columns.subject, exampleOneOffThread.subject!),
        lettersCopy.oneOff.fact(lettersCopy.oneOff.columns.mailbox, exampleOneOffThread.mailboxes!.join(", ")),
        lettersCopy.oneOff.fact(lettersCopy.oneOff.columns.messages, exampleOneOffThread.messages),
        lettersCopy.oneOff.fact(lettersCopy.oneOff.columns.when, staffTime(exampleOneOffThread.latestAt)),
      ].join(" · "),
    );
    await says("Could we meet?");
    await says(lettersCopy.oneOff.unreadable);
    // The out-of-office shows its first paragraph, the rest and its quote in one fold.
    await says("I'm away until Monday.");
    await expect.element(page.getByText("may be confidential", { exact: false })).not.toBeVisible();
    expect(page.getByText(lettersCopy.letterThread.quoted).query()).toBeNull();
    await page.getByText(lettersCopy.letterThread.autoInFull).click();
    await expect.element(page.getByText("> Could we meet?", { exact: false })).toBeVisible();
    for (const name of ["Placeholder, Polly", "polly.placeholder.mp@parliament.uk"]) {
      await expect.element(link(name)).toHaveAttribute("href", "/staff/politicians/1");
    }
    await says("Jane Smith <jane.smith@example.com>");
    await says("someone@example.com");
    expect(link("Joseph Example").query()).toBeNull();
    await rerender(<OneOffThreadView thread={{ ...exampleHiddenOneOff, messages_: null }} />);
    await says(lettersCopy.oneOff.hidden);
    // One that's hidden says neither who wrote in it nor its subject.
    await expect.element(title).toHaveTextContent(lettersCopy.oneOff.title);
    expect(facts()).not.toContain(lettersCopy.oneOff.columns.subject);
    expect(facts()).not.toContain(lettersCopy.oneOff.columns.mailbox);
    await rerender(
      <OneOffThreadView
        thread={{
          ...exampleOneOffThread,
          subject: "",
        }}
      />,
    );
    expect(facts()).toContain(
      lettersCopy.oneOff.fact(lettersCopy.oneOff.columns.subject, lettersCopy.oneOff.noSubject),
    );
    // Only one person wrote in it: the thread is with them.
    await rerender(<OneOffThreadView thread={{ ...exampleOneOffThread, participants: ["Jane Smith"] }} />);
    await expect.element(title).toHaveTextContent("Thread with Jane Smith");
    await rerender(<OneOffThreadView thread={{ ...exampleOneOffThread, people: [] }} />);
    await says(lettersCopy.oneOff.people.none);
  });

  it("rebuilds a forward's messages before it, oldest first, beside the politicians it's linked to", async () => {
    await render(<OneOffThreadView thread={exampleForwardThread} />);
    const emails = page.getByRole("article").all();
    expect(emails.map((email) => email.element().getAttribute("aria-label"))).toEqual([
      "Can we meet?",
      "Re: Can we meet?",
      "Fwd: my MP's answer",
    ]);
    const text = emails.map((email) => email.element().textContent);
    expect(text[0]).toContain("15 Oct 2026, at 11:17");
    // One rebuilt from an "On … wrote:" line says nothing of whom it was to, so it has no To.
    const heads = (i: number) => [...emails[i].element().querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(heads(0)).not.toContain(lettersCopy.letterThread.headers.to);
    expect(heads(1)).toContain(lettersCopy.letterThread.headers.to);
    expect(text[1]).toContain(lettersCopy.oneOff.rebuilt("Jane Smith"));
    expect(text[2]).toContain(lettersCopy.oneOff.forwardedAlone);
    await expect.element(link("pollyplaceholdermp@parliament.uk")).not.toBeInTheDocument();
    await expect.element(link("Polly Placeholder MP")).toHaveAttribute("href", "/staff/politicians/1");
    const people = page.getByRole("region", { name: lettersCopy.oneOff.people.title });
    await expect
      .element(people.getByRole("link", { name: "Polly Placeholder" }))
      .toHaveAttribute("href", "/staff/politicians/1");
  });

  it("shows a forward's note over what it carries, and a carried message copied to someone", async () => {
    const [message] = exampleForwardThread.messages_!;
    const [first, second] = message.forwarded;
    await render(
      <OneOffThreadView
        thread={{
          ...exampleForwardThread,
          messages_: [
            {
              ...message,
              fromName: "",
              text: "See below.",
              forwarded: [{ ...first, cc: "jo@example.com" }, second],
            },
          ],
        }}
      />,
    );
    await says("See below.");
    await says("jo@example.com");
    await expect.element(page.getByText(lettersCopy.oneOff.rebuilt(message.fromAddress)).first()).toBeVisible();
  });
});
