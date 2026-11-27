import { postJson } from "@/lib/ask-server";
import type { ChatLinkResult } from "@/lib/broadcasts/waiting-room";

/**
 * Asks app/api/whatsapp/waiting-room for the link that opens a chat with
 * our number. Throws when there's no answer to give: offline, or the server
 * erred.
 */
export function askChatLink(turnstileToken: string, utmSource: string): Promise<ChatLinkResult> {
  return postJson("/api/whatsapp/waiting-room", { turnstileToken, utmSource });
}
