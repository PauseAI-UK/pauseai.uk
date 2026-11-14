"use client";

// OptOutForm's example that logs what it records (OptOutForm.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { CONSENTS } from "@/lib/supporters/contact-permissions";
import { optOutChoices } from "@/lib/supporters/opt-out-choices";
import OptOutForm from "./OptOutForm";

/** Unsubscribe them, for a supporter with an address and a number. */
export function OptOutFormExample({ opened = false }: { opened?: boolean }) {
  const choices = optOutChoices([
    ...CONSENTS.map((c) => ({
      address: c.way === "email" ? "jane.smith@example.com" : "+447700900123",
      channel: c.way === "email" ? ("email" as const) : ("phone" as const),
      topic: c.topic,
      way: c.way,
      send: "yes" as const,
    })),
  ]);
  return (
    <Logged>
      {(log) => (
        <OptOutForm
          supporterId={1}
          choices={choices}
          record={async (form) => {
            log("record")(form);
            return true;
          }}
          opened={opened}
        />
      )}
    </Logged>
  );
}
