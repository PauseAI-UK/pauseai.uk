"use server";

// The WhatsApp waiting room's Server Actions: letting someone in, dismissing
// them, and setting the community's link. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import type { FormResult } from "@/lib/form-result";
import { requireStaff } from "@/lib/accounts/auth.server";
import { ownId } from "@/lib/staff-forms";
import { dismiss, letInByStaff, setCommunityLink, type DecisionRefusal } from "@/lib/broadcasts/waiting-room.server";

/** The waiting room's page, and the supporters' pages that show its chats. */
const refresh = () => revalidatePath("/staff/supporters", "layout");

/** Let in, send the link: someone the form's own `id` names. Refused if they've gone, or no link is set. */
export async function letInNow(form: FormData): Promise<FormResult<DecisionRefusal>> {
  const { email } = await requireStaff("supporters");
  const result = await letInByStaff(ownId(form), email);
  refresh();
  return result;
}

/** Dismisses someone for good: the form's own `id`. Refused if they've gone. */
export async function dismissNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff("supporters");
  const result = await dismiss(ownId(form), email);
  refresh();
  return result;
}

/** Sets the community's link to what staff pasted in `link`. Refused if it isn't an invite link. */
export async function setLinkNow(form: FormData): Promise<FormResult<"not-a-link">> {
  const { email } = await requireStaff("supporters");
  const result = await setCommunityLink(String(form.get("link") ?? ""), email);
  refresh();
  return result;
}
