"use client";

// SignupUploadPreview's examples, with the gallery's Server Actions (SignupUploadPreview.gallery.tsx).
import { exampleSignupPlan, exampleWhatsappPlan } from "./SignupUpload.examples";
import SignupUploadPreview, { SignupPlanView } from "./SignupUploadPreview";

/** The upload's Server Actions in the gallery: a preview with someone in every pile, and an import that's upload 6. */
export const exampleUploadActions = {
  preview: async () => exampleSignupPlan,
  finish: async () => ({ uploadId: exampleSignupPlan.rows.length }),
};

/** The preview of a file with someone in every pile. */
export function SignupPlanViewExample() {
  return <SignupPlanView plan={exampleSignupPlan} />;
}

/** The preview of a WhatsApp group's file. */
export function WhatsappPlanViewExample() {
  return <SignupPlanView plan={exampleWhatsappPlan} />;
}

/** What a file will do, worked out by the example's preview, with its import. */
export function SignupUploadPreviewExample() {
  return <SignupUploadPreview step={4} input={exampleSignupPlan.input} blockers={[]} {...exampleUploadActions} />;
}
