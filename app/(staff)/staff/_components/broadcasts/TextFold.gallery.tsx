// TextFold in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import TextFold from "./TextFold";

export const textFoldGallery: Example[] = [
  {
    name: "TextFold",
    file: "app/(staff)/staff/_components/broadcasts/TextFold.tsx",
    variants: [
      {
        label: "Words that fit",
        render: () => (
          <TextFold>
            <p>The march meets at 11:00.</p>
          </TextFold>
        ),
      },
      {
        label: "Words folded at five lines, with Read more",
        render: () => (
          <TextFold>
            <p>The march meets at 11:00 at Parliament Square.</p>
            <p>Bring water.</p>
            <p>Wear orange.</p>
            <p>Look for the flags.</p>
          </TextFold>
        ),
      },
    ],
  },
];
