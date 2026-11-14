// TextBubble in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { exampleWhatsAppWords } from "./BroadcastWriter.examples";
import TextBubble, { ChatBubble, ChatWall, LinkedText, TextWords } from "./TextBubble";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";

export const textBubbleGallery: Example[] = [
  {
    name: "TextBubble",
    file: "app/(staff)/staff/_components/broadcasts/TextBubble.tsx",
    variants: [
      {
        label: "A text with its footer",
        render: () => (
          <TextBubble from="PauseAI UK" words={exampleWhatsAppWords} footer={TEMPLATE_FOOTER} time="07:18" />
        ),
      },
    ],
  },
  {
    name: "TextWords",
    file: "app/(staff)/staff/_components/broadcasts/TextBubble.tsx",
    variants: [
      {
        label: "A text's words as WhatsApp shows them, in a bubble of our own",
        render: () => (
          <ChatWall>
            <ChatBubble who="PauseAI UK" when="07:18" ours>
              <TextWords words={exampleWhatsAppWords} />
            </ChatBubble>
          </ChatWall>
        ),
      },
    ],
  },
  {
    name: "LinkedText",
    file: "app/(staff)/staff/_components/broadcasts/TextBubble.tsx",
    variants: [
      {
        label: "A text's words, each web address a link",
        render: () => <LinkedText text="Sign up at https://pauseai.uk/join, or www.example.org." />,
      },
    ],
  },
  {
    name: "ChatWall",
    file: "app/(staff)/staff/_components/broadcasts/TextBubble.tsx",
    variants: [
      {
        label: "A conversation",
        render: () => (
          <ChatWall>
            <ChatBubble who="Jane" when="07:52">
              Can I bring my dog?
            </ChatBubble>
            <ChatBubble who="Jo" when="08:10" ours>
              Yes.
            </ChatBubble>
          </ChatWall>
        ),
      },
    ],
  },
  {
    name: "ChatBubble",
    file: "app/(staff)/staff/_components/broadcasts/TextBubble.tsx",
    variants: [
      {
        label: "Theirs",
        render: () => (
          <ChatBubble who="Jane" when="07:52">
            Can I bring my dog?
          </ChatBubble>
        ),
      },
    ],
  },
];
