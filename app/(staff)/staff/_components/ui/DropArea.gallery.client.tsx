"use client";

// DropArea's examples, which log the names of the files dropped or chosen (DropArea.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import DropArea from "./DropArea";

export function DropAreaExample({ pending = false }: { pending?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <DropArea
          hint="Drag files here"
          choose="Choose files"
          multiple
          pending={pending}
          onFiles={(files) => log("onFiles")(files.map((file) => file.name))}
        />
      )}
    </Logged>
  );
}
