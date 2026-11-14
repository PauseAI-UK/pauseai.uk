"use client";

// SignupUploadForm's example, with the gallery's Server Actions (SignupUploadForm.gallery.tsx).
import SignupUploadForm from "./SignupUploadForm";
import { exampleUploadActions } from "./SignupUploadPreview.gallery.client";

/** The upload page before a file, with an event to come. */
export function SignupUploadFormExample() {
  return (
    <SignupUploadForm
      today="2026-10-31"
      events={[
        {
          id: "evt-march",
          name: "PauseAI London March",
          startAt: new Date("2026-11-21T12:00:00Z"),
          url: "https://luma.com/example",
        },
      ]}
      actions={exampleUploadActions}
    />
  );
}
