import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import {
  DraftFootExample,
  DraftTitleExample,
  MailingStandingExample,
  MessageCopyViewExample,
  ReplyActionsExample,
  AnswerableReplyExample,
  BroadcastForExample,
  BroadcastConsentExample,
  BroadcastSupportersExample,
  BroadcastViewExample,
  BroadcastWriterExample,
  ChoosingBroadcastFrameExample,
} from "./staff-broadcasts.client";

const copy = staffCopy.broadcastPages;

it("logs a draft's actions in the writer's example", async () => {
  await render(<BroadcastWriterExample kind="email" />);
  await page.getByLabelText(copy.subject).fill("Changed");
  await page.getByRole("button", { name: copy.sendTest }).click();
  const log = page.getByRole("list", { name: "Event log" }).getByRole("listitem");
  await expect.element(log.nth(0)).toHaveTextContent('saveBroadcast(3, 4, {"subject":"Changed"})');
  // Filled in for someone made up, meeting what the preview's buttons say.
  await expect
    .element(page.getByText(/^sendBroadcastTestNow\(3, \["has:firstName",.*"jo@pauseai\.uk"\)$/))
    .toBeVisible();
});

it("draws each kind of writer", async () => {
  for (const kind of ["choose", "template", "new", "rejected", "off"] as const) {
    const view = await render(<BroadcastWriterExample kind={kind} />);
    await expect.element(page.getByRole("heading", { name: copy.sections.write })).toBeVisible();
    await view.unmount();
  }
});

it("draws the rest", async () => {
  await render(
    <>
      <DraftTitleExample />
      <DraftFootExample />
      <BroadcastConsentExample />
      <BroadcastSupportersExample />
      <ChoosingBroadcastFrameExample />
      <BroadcastViewExample kind="email" />
      <BroadcastViewExample kind="text" />
      <BroadcastViewExample kind="scheduled" />
      <BroadcastForExample />
      <MessageCopyViewExample />
      <MessageCopyViewExample email />
      <MessageCopyViewExample email replies />
      <ReplyActionsExample />
    </>,
  );
  await expect.element(page.getByText(staffCopy.mailingPages.states.scheduled, { exact: true }).first()).toBeVisible();
});

it("logs what a reply is recorded as", async () => {
  await render(<ReplyActionsExample />);
  await page.getByRole("button", { name: copy.replies.nothing }).click();
  await expect
    .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
    .toHaveTextContent('deal({"replyId":"1","decision":"nothing"})');
});

it("logs an answer sent to a reply", async () => {
  await render(<AnswerableReplyExample opened />);
  await page.getByRole("textbox", { name: copy.replies.answerLabel }).fill("Thanks");
  await page.getByRole("button", { name: copy.replies.send }).click();
  await expect
    .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
    .toHaveTextContent(/^answer\(1, "[0-9a-f-]{36}", \{"type":"doc"/);
});

it("does nothing when an action is pressed", async () => {
  await render(<MailingStandingExample />);
  await page.getByRole("button", { name: staffCopy.mailingPages.stopSending }).click();
  await expect.element(page.getByRole("button", { name: staffCopy.mailingPages.stopSending })).toBeVisible();
});

it("leaves the draft's foot as it was when Schedule is refused", async () => {
  await render(<DraftFootExample />);
  const schedule = page.getByRole("button", { name: "Schedule 412 emails" }).first();
  await schedule.click();
  await expect.element(schedule).toBeEnabled();
});
