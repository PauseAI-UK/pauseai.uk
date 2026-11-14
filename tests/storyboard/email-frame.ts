import type { Page } from "@playwright/test";
import type { OutboxEmail } from "@/lib/server/fixtures/outbox";
import { emailView } from "../fixtures/email-view";
import { frame } from "./frame";

/**
 * A frame of an email the build sent (from the outbox, ./outbox-steps.ts), as
 * a plain mail app shows it (tests/fixtures/email-view.ts): its headers, its
 * body and its attachments. In a page of its own, at the flow's viewport,
 * closed afterwards, so the flow's page is left where it was.
 */
export async function emailFrame(page: Page, email: OutboxEmail, caption: string): Promise<void> {
  const mail = await page.context().newPage();
  try {
    await mail.setContent(emailView(email));
    await frame(mail, caption);
  } finally {
    await mail.close();
  }
}
