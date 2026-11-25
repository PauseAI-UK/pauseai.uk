import type { ButtonHTMLAttributes } from "react";
import styles from "./IconButton.module.css";

export type IconButtonLook = "outline" | "raised" | "dark";

/**
 * A × for a round button that closes or takes something off: drawn, so it's
 * centred in the button whatever the font, as a typed one sits where its
 * font puts it. `size` is its width and height in pixels.
 */
export function CrossIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A round button's class, for a button that something else draws, such as a menu's (ui/Menu). */
export function iconButtonClass(look: IconButtonLook, className?: string): string {
  return [styles.button, styles[look], className].filter(Boolean).join(" ");
}

/**
 * A round button with an icon (or a single glyph) in it, and an accessible
 * name in `aria-label`. `outline` is a thin ring that fills orange on
 * hover; `raised` a white disc with a shadow; `dark` a pale ring for a dark
 * backdrop. Its diameter is `--icon-button-size`, which a container can set
 * on itself, or `size` sets on the button. A className is for its place in
 * the layout (position, offsets), never its look.
 */
export default function IconButton({
  look,
  size,
  className,
  style,
  type = "button",
  ...rest
}: { look: IconButtonLook; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type={type}
      className={iconButtonClass(look, className)}
      style={size ? { ...style, ["--icon-button-size" as string]: `${size}px` } : style}
    />
  );
}
