import { ButtonLink } from "@/components/ui/Button";
import { whatsappCopy as copy } from "@/lib/content/whatsapp";

/** The WhatsApp page while the community's waiting room is down: to the home page's sign-up instead. */
export default function WaitingRoomDown() {
  return (
    <>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <ButtonLink variant="primary" href="/#join">
        {copy.button}
      </ButtonLink>
    </>
  );
}
