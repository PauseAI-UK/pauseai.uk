import "server-only";
import { query } from "@/lib/server/db.server";
import { siteUrl } from "@/lib/site-url.server";
import { MOST_PICTURE_BYTES } from "./text-parts";

// The pictures staff upload for the top of a text (text_pictures): kept
// here, and served from the site at an address no one can guess, which
// WhatsApp fetches as each text goes, and which the writer's preview shows.

/** The kinds of picture WhatsApp takes for a template's top. */
export const PICTURE_TYPES = ["image/jpeg", "image/png"] as const;

/** Why a file isn't kept as a text's picture: not a JPEG or PNG, or too big. */
export type PictureRefusal = "not-picture" | "too-big";

/** Keeps a picture `by` staff uploaded, if it's one WhatsApp takes; its ID, or why not. */
export async function keepPicture(
  file: { type: string; content: Buffer },
  by: string,
): Promise<{ id: string } | { refused: PictureRefusal }> {
  if (!(PICTURE_TYPES as readonly string[]).includes(file.type)) return { refused: "not-picture" };
  if (file.content.length > MOST_PICTURE_BYTES) return { refused: "too-big" };
  const [{ id }] = await query<{ id: string }>(
    "INSERT INTO text_pictures (content, content_type, created_by) VALUES ($1, $2, $3) RETURNING id",
    [file.content, file.type, by],
  );
  return { id };
}

/** A kept picture's bytes and kind, or none for an ID that isn't one's. */
export async function pictureOf(id: string): Promise<{ content: Buffer; type: string } | undefined> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const [picture] = await query<{ content: Buffer; type: string }>(
    "SELECT content, content_type AS type FROM text_pictures WHERE id = $1",
    [id],
  );
  return picture;
}

/** Where WhatsApp fetches a picture from: the site's own address, as WhatsApp needs one it can reach. */
export function pictureAddress(id: string): string {
  return siteUrl(`/api/text-pictures/${id}`, undefined).toString();
}
