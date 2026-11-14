"use client";

// SignupUploadHelp's example, which opens and closes (SignupUploadHelp.gallery.tsx).
import { useState } from "react";
import SignupUploadHelp, { SignupColumnNames } from "./SignupUploadHelp";

/** What the file needs, with its button opening and closing the full list. */
export function SignupUploadHelpExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SignupUploadHelp open={open} onToggle={() => setOpen(!open)} />
      {open && <SignupColumnNames />}
    </>
  );
}
