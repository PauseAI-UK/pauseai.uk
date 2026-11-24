/** A staff page to go back to, with its query, never another site's; `fallback` for anything else. */
export function staffBack(back: string | null | undefined, fallback: string): string {
  return back && /^\/staff(\/[\w\-/]*)?(\?[^#]*)?$/.test(back) && !back.includes("//") ? back : fallback;
}
