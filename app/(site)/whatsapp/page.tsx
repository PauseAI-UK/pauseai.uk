import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import ProsePage from "@/components/ui/ProsePage";
import { whatsappCopy as copy } from "@/lib/content/whatsapp";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: copy.title,
  description: copy.description,
  path: "/whatsapp",
});

/** Where every button for the WhatsApp community leads: its waiting room is down, so to the sign-up instead. */
export default function WhatsAppPage() {
  return (
    <ProsePage>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <ButtonLink variant="primary" href="/#join">
        {copy.button}
      </ButtonLink>
    </ProsePage>
  );
}
