// The email settings page's pieces (app/(site)/email-settings/_components/).
import ProsePage from "@/components/ui/ProsePage";
import {
  exampleBlocked,
  exampleDoNotEmail,
  exampleNoBulk,
  exampleSettings,
  exampleUnsubscribed,
} from "@/app/(site)/email-settings/_components/EmailSettings.examples";
import type { Group } from "../_components/types";
import { EmailSettingsExample, SettingsStartExample } from "./email-settings.client";

export const emailSettings: Group = {
  id: "email-settings",
  title: "Email settings",
  examples: [
    {
      name: "SettingsStart",
      file: "app/(site)/email-settings/_components/SettingsStart.tsx",
      variants: [
        {
          label: "Asking for a link, with no Turnstile",
          render: () => (
            <ProsePage>
              <SettingsStartExample />
            </ProsePage>
          ),
        },
      ],
    },
    {
      name: "EmailSettings",
      file: "app/(site)/email-settings/_components/EmailSettings.tsx",
      variants: [
        {
          label: "The newsletter by email and text, events by following Luma",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={exampleSettings} />
            </ProsePage>
          ),
        },
        {
          label: "From a newsletter's unsubscribe link: its button first",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={exampleUnsubscribed} unsubscribe={["newsletter"]} />
            </ProsePage>
          ),
        },
        {
          label: "“No bulk emails”, which they can lift: email held, texts not",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={exampleNoBulk} />
            </ProsePage>
          ),
        },
        {
          label: "“Do not email”, which only PauseAI Global can lift",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={exampleDoNotEmail} />
            </ProsePage>
          ),
        },
        {
          label: "Emails to the address bounced",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={exampleBlocked} />
            </ProsePage>
          ),
        },
        {
          label: "A link asked for, run out: a fresh one offered",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={null} />
            </ProsePage>
          ),
        },
        {
          label: "An old email's unsubscribe link: its button still works, a fresh link for the rest",
          render: () => (
            <ProsePage>
              <EmailSettingsExample view={null} unsubscribe={["events"]} />
            </ProsePage>
          ),
        },
      ],
    },
  ],
};
