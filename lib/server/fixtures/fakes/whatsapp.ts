import type { Fake } from "../fake";
import { whatsAppResponse } from "../whatsapp";

// Meta's Graph API for WhatsApp (../whatsapp.ts).

export const whatsAppFake: Fake = ({ hostname, pathname }, init) =>
  hostname === "graph.facebook.com" ? whatsAppResponse(pathname, init) : undefined;
