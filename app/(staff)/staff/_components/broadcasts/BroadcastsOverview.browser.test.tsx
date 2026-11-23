import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { mailingGroups } from "@/lib/mailings/groups";
import type { BroadcastSummary } from "@/lib/broadcasts/pages.server";
import { exampleBroadcastSummary } from "./BroadcastWriter.examples";
import BroadcastsOverview from "./BroadcastsOverview";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;
const stateWords = lettersCopy.copyStates;

describe("BroadcastsOverview", () => {
  const now = "2026-11-05T12:00:00Z";

  it("shows, under one sending's bar, what needs a look already, in colour, each leading to its tab", async () => {
    const sending = (id: number, title: string, more: Partial<BroadcastSummary>): BroadcastSummary => ({
      ...exampleBroadcastSummary,
      id,
      title,
      state: "sending",
      dueAt: new Date("2026-11-05T11:00:00Z"),
      to: 7,
      sent: 4,
      failed: 0,
      states: { ...exampleBroadcastSummary.states, "opted-out": 0, error: 0, unreached: 0, look: 0 },
      ...more,
    });
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            scheduled: [],
            drafts: [],
            sending: [
              sending(4, "Going badly", {
                states: { ...exampleBroadcastSummary.states, "opted-out": 1, error: 2, unreached: 0, look: 1 },
              }),
              sending(6, "Going well", {}),
            ],
            done: [],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    await expect.element(page.getByText(mailingsCopy.mailingPages.sendingBar(4, 7)).first()).toBeVisible();
    const need = (words: string) => page.getByRole("link", { name: words, exact: true });
    await expect.element(need(`2 ${stateWords.counts.error}`)).toHaveAttribute("href", "/staff/broadcasts/4?tab=error");
    await expect
      .element(need(`1 ${stateWords.counts["opted-out"]}`))
      .toHaveAttribute("href", "/staff/broadcasts/4?tab=opted-out");
    await expect.element(need(`1 ${stateWords.counts.look}`)).toHaveAttribute("href", "/staff/broadcasts/4?tab=look");
    // Nothing to look at, nothing under the bar.
    expect(page.getByRole("link", { name: new RegExp(stateWords.counts.error!) }).elements()).toHaveLength(1);
  });

  it("says one sending with nothing going out is waiting, and for what, in place of sending now, its bar another tone", async () => {
    const sending = (id: number, pause: BroadcastSummary["pause"]): BroadcastSummary => ({
      ...exampleBroadcastSummary,
      id,
      title: `Broadcast ${id}`,
      state: "sending",
      dueAt: new Date("2026-11-05T11:00:00Z"),
      to: 7,
      sent: 4,
      failed: 0,
      pause,
    });
    const until = new Date("2026-11-06T10:07:00Z");
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            // Scheduled, past its time, waiting for CiviCRM: it has no bar.
            scheduled: [
              { ...sending(8, { kind: "waiting", reason: "pull", said: null, endsAt: until }), state: "scheduled" },
              // Waiting for WhatsApp's approval, it says so as it did before its time, not that it's paused.
              {
                ...sending(9, { kind: "waiting", reason: "approval", said: null, endsAt: until }),
                state: "scheduled",
                waiting: true,
              },
            ],
            sending: [sending(4, null), sending(6, { kind: "held", held: 3, until, stopsAt: until })],
            drafts: [],
            done: [],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    const row = (id: number) => page.getByRole("listitem").filter({ hasText: `Broadcast ${id}` });
    const bar = (id: number) => row(id).getByRole("progressbar").element();
    await expect.element(row(4).getByText(mailingsCopy.mailingPages.sendingNow, { exact: true })).toBeVisible();
    await expect.element(row(4).getByText(mailingsCopy.mailingPages.sendingBar(4, 7))).toBeVisible();
    await expect.element(row(6).getByText(copy.paused.word, { exact: true })).toBeVisible();
    await expect.element(row(6).getByText(copy.paused.till("Fri 6 Nov, 10:18"))).toBeVisible();
    await expect.element(row(6).getByText(copy.paused.bar(4, 7))).toBeVisible();
    expect(row(6).element().textContent).not.toContain(mailingsCopy.mailingPages.sendingNow);
    expect(bar(6).className).not.toBe(bar(4).className);
    await expect.element(row(8).getByText(copy.paused.word, { exact: true })).toBeVisible();
    await expect.element(row(8).getByText(copy.paused.forCiviCrm)).toBeVisible();
    expect(row(8).getByRole("progressbar").elements()).toHaveLength(0);
    await expect.element(row(9).getByText(copy.standing.waiting)).toBeVisible();
    expect(row(9).getByText(copy.paused.word, { exact: true }).elements()).toHaveLength(0);
  });

  it("lists emails and texts, each with its channel, leading to its page", async () => {
    const waiting = {
      ...exampleBroadcastSummary,
      id: 4,
      state: "scheduled" as const,
      channel: "text" as const,
      title: "Waiting",
      sentFrom: "+447700900000",
    };
    const plain = { ...exampleBroadcastSummary, id: 6, state: "scheduled" as const, title: "Plain" };
    const held = {
      ...exampleBroadcastSummary,
      id: 8,
      state: "draft" as const,
      title: "Held",
      waiting: true,
      sentFrom: null,
      fromName: null,
    };
    const turnedDown = {
      ...exampleBroadcastSummary,
      id: 9,
      state: "draft" as const,
      title: "Turned down",
      rejected: true,
    };
    const ready = {
      ...exampleBroadcastSummary,
      id: 10,
      state: "draft" as const,
      channel: "text" as const,
      title: "Ready",
      approved: true,
    };
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            scheduled: [waiting, plain],
            sending: [],
            drafts: [held, turnedDown, ready],
            // By Postmark, so it counts what arrived.
            done: [
              {
                ...exampleBroadcastSummary,
                title: "",
                sendBy: "postmark" as const,
                states: { ...exampleBroadcastSummary.states, delivered: 276 },
              },
            ],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Waiting" })).toHaveAttribute("href", "/staff/broadcasts/4");
    // Its channel's icon before its title, named.
    await expect.element(page.getByRole("img", { name: copy.channels.text }).first()).toBeVisible();
    await expect.element(page.getByRole("img", { name: copy.channels.email }).first()).toBeVisible();
    // Under the title, its channel's name, then who it's from, a dot between.
    const lineUnder = (title: string) =>
      page.getByRole("link", { name: title }).element().closest("[class*=head]")!.nextElementSibling!;
    expect(lineUnder("Waiting").textContent).toBe(`${copy.channels.text} · PauseAI UK · 07700 900000`);
    // With no one it's from yet, its channel alone.
    expect(lineUnder("Held").textContent).toBe(copy.channels.email);
    // Where each stands, as a sentence: a draft whose words WhatsApp is reviewing.
    await expect.element(page.getByText(copy.standing.waiting)).toBeVisible();
    // And one whose words it rejected, till they're sent again.
    await expect.element(page.getByText(copy.standing.rejected)).toBeVisible();
    expect(page.getByText(copy.standing.rejected).all()).toHaveLength(1);
    // And one whose words it approved, ready to schedule, with a green dot.
    const approved = page.getByText(copy.standing.approved(ready.to));
    await expect.element(approved).toBeVisible();
    expect(approved.element().querySelector("[data-tone]")!.getAttribute("data-tone")).toBe("green");
    await expect.element(page.getByText(mailingsCopy.mailingPages.standing.scheduled(290)).first()).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.untitled }).first()).toBeVisible();
    // One sent: how many it went to; then what needs a look, the rest folded behind how many are fine.
    await expect.element(page.getByText(mailingsCopy.mailingPages.standing.sent(290))).toBeVisible();
    await expect.element(page.getByRole("link", { name: `4 ${stateWords.counts.error}` })).toBeVisible();
    await expect.element(page.getByRole("button", { name: / fine/ }).first()).toBeVisible();
  });

  it("says where each one that went stands: sent, stopped by us, or stopped by itself and why", async () => {
    const went = (id: number, title: string, more: Partial<BroadcastSummary>): BroadcastSummary => ({
      ...exampleBroadcastSummary,
      id,
      title,
      to: 5,
      sent: 3,
      ...more,
    });
    const stopped = { state: "cancelled" as const };
    const gaveUp = (waitReason: string) => ({ state: "cancelled" as const, gaveUp: true, waitReason });
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            scheduled: [],
            sending: [],
            drafts: [],
            done: [
              went(1, "Sent", { state: "sent" }),
              went(2, "Stopped by us", stopped),
              went(3, "Out of time", gaveUp("limit")),
              went(4, "CiviCRM down", gaveUp("civicrm")),
              went(5, "No pull", gaveUp("pull")),
              went(6, "Template paused", gaveUp("template")),
              went(7, "Late", gaveUp("late")),
              went(8, "Failing", gaveUp("failing")),
              went(9, "Never approved", gaveUp("approval")),
            ],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    const words = copy.standing;
    for (const said of [
      mailingsCopy.mailingPages.standing.sent(5),
      mailingsCopy.mailingPages.standing.stopped(3, 5),
      words.gaveUp.limit!(3, 5),
      words.gaveUp.template!(3, 5),
      words.gaveUp.late!(3, 5),
      words.gaveUp.failing!(3, 5),
      words.gaveUp.approval!(0, 5),
    ]) {
      await expect.element(page.getByText(said)).toBeVisible();
    }
    // Those it never sent aren't fine for one stopped, so they show, for each of the eight; for the one sent,
    // those are as expected, folded with the fine.
    expect(page.getByRole("link", { name: `8 ${stateWords.counts["not-sent"]}` }).all()).toHaveLength(8);
    // CiviCRM down, or no fresh pull from it, read the same.
    expect(page.getByText(words.gaveUp.civicrm!(3, 5)).all()).toHaveLength(2);
    expect(words.gaveUp.pull!(3, 5)).toBe(words.gaveUp.civicrm!(3, 5));
  });

  it("says when there are none", async () => {
    await render(<BroadcastsOverview groups={[]} now={now} />);
    await expect.element(page.getByText(copy.none)).toBeVisible();
  });
});
