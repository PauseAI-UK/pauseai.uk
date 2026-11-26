"use client";

// TextTop's examples, which change as they're used and log finding places and uploading pictures (TextTop.gallery.tsx).
import { Controlled, Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import TextTop from "./TextTop";
import { examplePictureId, examplePlace } from "./BroadcastWriter.examples";

type Top = { header: TextHeader | null; place: TextPlace | null; pictureId: string | null };

export function TextTopExample({ initial, fixed = false, link }: { initial: Top; fixed?: boolean; link?: string }) {
  return (
    <Logged>
      {(log) => (
        <Controlled initial={initial} show={(top) => JSON.stringify(top)}>
          {(top, set) => (
            <TextTop
              header={top.header}
              place={top.place}
              pictureId={top.pictureId}
              link={link}
              onChange={(change) => set({ ...top, ...change })}
              findPlaces={async (input) => {
                log("findPlaces")(input);
                return [examplePlace, { ...examplePlace, name: "Parliament Square Garden" }];
              }}
              uploadPicture={async (file) => {
                log("uploadPicture")(file.name);
                return { pictureId: examplePictureId };
              }}
              fixed={fixed}
            />
          )}
        </Controlled>
      )}
    </Logged>
  );
}
