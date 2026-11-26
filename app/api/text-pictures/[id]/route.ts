import { pictureOf } from "@/lib/broadcasts/text-pictures.server";

// A text's picture, for WhatsApp to fetch as each text with it goes, and
// for the writer's preview: anyone with its address can see it, as anyone
// a text goes to can; the address is a random ID no one can guess.

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const picture = await pictureOf((await params).id);
  if (!picture) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(picture.content), {
    headers: { "Content-Type": picture.type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
