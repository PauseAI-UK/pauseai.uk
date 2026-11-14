import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import { reviewTemplate } from "./broadcast-drafts.server";
import { textBackend } from "./broadcast-channels.server";
import { stopTextsOn } from "./broadcast-sending.server";
import { query } from "./db.server";
import { notifyStaff } from "./notifications.server";
import { listTemplates, type MetaTemplate } from "./outside-services/whatsapp.server";
import { problem } from "./problems.server";

// What WhatsApp decides of our templates, told by its webhook
// (whatsapp-webhooks.server.ts), or found by asking it each run of the sending
// while one waits for it or a text is to go (checkTemplates), in case a
// webhook went astray: approved or rejected; or, once approved, paused or
// disabled for its quality, which stops the texts on it, or approved again.
// A template is found by the name WhatsApp has it by: one sent from here
// has its own (meta_name); one made in WhatsApp Manager is called that here.

/**
 * Applies a status WhatsApp gives template `name`, and the category it
 * approved it as, if it says. Says whether it changed anything.
 */
export async function applyTemplateStatus(
  name: string,
  status: string,
  reason: string | null,
  category?: string,
): Promise<boolean> {
  const [template] = await query<{ id: number; status: string; name: string }>(
    "SELECT id::int AS id, status, name FROM whatsapp_templates WHERE coalesce(meta_name, name) = $1",
    [name],
  );
  if (!template) return false;
  if (category && ["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) {
    await query("UPDATE whatsapp_templates SET category = $2 WHERE id = $1", [template.id, category]);
  }
  if (status === "APPROVED" || status === "REINSTATED") {
    if (template.status === "pending") return reviewTemplate(template.id, { approved: true });
    if (template.status !== "paused" && template.status !== "disabled") return false;
    await query("UPDATE whatsapp_templates SET status = 'approved', stopped_at = NULL WHERE id = $1", [template.id]);
    return true;
  }
  if (status === "REJECTED") {
    return template.status === "pending" && reviewTemplate(template.id, { approved: false, reason: reason ?? "NONE" });
  }
  if ((status === "PAUSED" || status === "DISABLED") && template.status === "approved") {
    await query("UPDATE whatsapp_templates SET status = $2, stopped_at = now() WHERE id = $1", [
      template.id,
      status.toLowerCase(),
    ]);
    const stopped = await stopTextsOn(template.id);
    const email = staffCopy.notifications.templatePaused;
    await notifyStaff(email.subject(template.name), email.body(template.name, stopped), null, "staff-alert");
    return true;
  }
  return false;
}

/**
 * Asks WhatsApp what it has decided of our templates, and applies it, while
 * one waits for it or a text is to go; reports it if WhatsApp doesn't answer.
 */
export async function checkTemplates(): Promise<void> {
  const [{ needed }] = await query<{ needed: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM whatsapp_templates WHERE status = 'pending')
       OR EXISTS (SELECT 1 FROM mailings WHERE channel = 'text' AND state IN ('scheduled', 'sending')) AS needed`,
  );
  if (!needed) return;
  const backend = await textBackend();
  if (!backend) return;
  let templates: MetaTemplate[];
  try {
    templates = await listTemplates(backend.keys);
  } catch (error) {
    problem(staffCopy.problems.anywhere.whatsAppUnanswered, error);
    return;
  }
  for (const template of templates) {
    await applyTemplateStatus(template.name, template.status, template.rejectedReason, template.category);
  }
}
