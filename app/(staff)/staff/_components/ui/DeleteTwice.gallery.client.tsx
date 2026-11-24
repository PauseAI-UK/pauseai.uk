"use client";

// DeleteTwice's examples that keep state or log what's pressed (DeleteTwice.gallery.tsx).
import { DeleteTwice } from "./DeleteTwice";
import { Logged, loggedDone } from "@/app/(tools)/gallery/_components/wiring";
import { refused } from "@/lib/form-result";

/** A delete pressed twice, logged; one that can't be pressed; and one that's refused, saying why under itself. */
export function DeleteTwiceExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <DeleteTwice
            name="slug"
            value="winter-reception-dec-2026"
            label="Delete ask"
            says={{}}
            action={loggedDone(log, "delete")}
          />
          <DeleteTwice
            name="slug"
            value="frontier-ai-letter"
            label="Delete ask"
            disabled
            says={{}}
            action={loggedDone(log, "delete")}
          />
          <DeleteTwice
            name="slug"
            value="march-letter"
            label="Delete ask"
            says={{ "in-use": "Politicians have answered this ask, so it can't be deleted." }}
            action={(form) => {
              log("delete")(form);
              return Promise.resolve(refused("in-use"));
            }}
          />
        </>
      )}
    </Logged>
  );
}
