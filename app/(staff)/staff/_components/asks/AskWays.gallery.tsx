// AskWays in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import AskWays from "./AskWays";
import { exampleAskPage } from "./AsksList.examples";

export const askWaysGallery: Example[] = [
  {
    name: "AskWays",
    file: "app/(staff)/staff/_components/asks/AskWays.tsx",
    variants: [
      { label: "Named", render: () => <AskWays ways={exampleAskPage.ways} /> },
      { label: "Wide, with their letters", render: () => <AskWays ways={exampleAskPage.ways} wide /> },
    ],
  },
];
