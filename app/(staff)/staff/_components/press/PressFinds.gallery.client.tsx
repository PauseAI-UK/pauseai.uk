"use client";

// The staff Press page's examples, whose buttons log what they send (PressFinds.gallery.tsx).
import { Logged, type Log } from "@/app/(tools)/gallery/_components/wiring";
import type { PressPage } from "@/lib/press/finds.server";
import PressFinds, { AddPiece } from "./PressFinds";

/** An action that logs the form it's sent as `name`, and is done. */
const sends = (log: Log, name: string) => (form: FormData) => {
  log(name)(form);
  return Promise.resolve({ ok: true as const });
};

/** The page's lists, on `page`. */
export function PressFindsExample({ page }: { page: PressPage }) {
  return (
    <Logged>
      {(log) => (
        <PressFinds
          page={page}
          actions={{
            add: sends(log, "addFindNow"),
            turnDown: sends(log, "turnDownFindNow"),
            restore: sends(log, "restorePieceNow"),
            edit: sends(log, "editPieceNow"),
            editFind: sends(log, "editFindNow"),
            remove: sends(log, "removePieceNow"),
          }}
        />
      )}
    </Logged>
  );
}

/** Add a piece, as at the top right of the page. */
export function AddPieceExample() {
  return <Logged>{(log) => <AddPiece act={sends(log, "addPieceNow")} />}</Logged>;
}
