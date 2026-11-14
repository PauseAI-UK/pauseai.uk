"use client";

// MailingFiles's examples, which log a file added or taken off (MailingFiles.gallery.tsx).
import MailingFiles from "./MailingFiles";
import { exampleWrittenMailing } from "./MailingWriter.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/**
 * A mailing's files: a PDF, an image and a file of no kind to draw; with the
 * box for more, and each to take off. There's no mailing to serve them in the
 * gallery, so each shows the sheet with its kind.
 */
export function MailingFilesExample({ editable }: { editable: boolean }) {
  return (
    <Logged>
      {(log) => (
        <MailingFiles
          files={exampleWrittenMailing.attachments}
          base="/staff/mailings/12/files"
          onAdd={editable ? log("onAdd") : undefined}
          onRemove={editable ? log("onRemove") : undefined}
        />
      )}
    </Logged>
  );
}
