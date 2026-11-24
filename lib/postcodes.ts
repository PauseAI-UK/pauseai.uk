// Postcodes as people type them, compared and shown.

/** "sw1a 1aa " → "SW1A1AA", for comparing postcodes. */
export function normalisePostcode(postcode: string): string {
  return postcode.replace(/\s+/g, "").toUpperCase();
}

/** "sw1a1aa" → "SW1A 1AA", the way postcodes are written: the inward part is the last three characters. */
export function displayPostcode(postcode: string): string {
  const bare = normalisePostcode(postcode);
  return bare.length > 3 ? `${bare.slice(0, -3)} ${bare.slice(-3)}` : bare;
}
