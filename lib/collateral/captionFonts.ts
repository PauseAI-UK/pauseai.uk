// The fonts of the caption under a standalone QR code (qrCaption.ts), apart from its
// layout, so code that draws a QR code needn't load the caption's measuring and fonts.
export type CaptionKind = "label" | "link";

/** The label is set like a headline, the link like body text. Both families are canvas fonts (canvasFonts.client.ts). */
export const CAPTION_FONTS: Record<CaptionKind, { family: string; weight: number; file: string; weightRange: string }> =
  {
    label: { family: "PAI Lato", weight: 900, file: "/fonts/lato-latin-900-normal.woff2", weightRange: "900" },
    link: { family: "PAI Inter", weight: 500, file: "/fonts/inter-latin-wght-normal.woff2", weightRange: "100 900" },
  };

/** Canvas and SVG font shorthand, with fallbacks for SVGs opened where the embedded fonts are not supported. */
export function captionFont(kind: CaptionKind, fontSize: number): string {
  const { family, weight } = CAPTION_FONTS[kind];
  const fallback = kind === "label" ? "Lato, Arial, sans-serif" : "Inter, Arial, sans-serif";
  return `${weight} ${fontSize}px "${family}", ${fallback}`;
}
