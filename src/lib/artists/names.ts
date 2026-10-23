/**
 * Canonical form for matching artist / band names across imports and merges.
 * Collapses “The Foo Band” / “Foo Band” / “Foo” to the same key.
 */
export function normalizeArtistName(raw: string): string {
  let value = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  value = value.toLowerCase().trim();
  value = value.replace(/['’`]/g, "");
  value = value.replace(/&/g, " and ");
  value = value.replace(/[^a-z0-9\s]+/g, " ");
  value = value.replace(/\s+/g, " ").trim();
  value = value.replace(/^the\s+/, "");
  // Strip a trailing band/group word only — keeps names like “The Band” recoverable via fallback.
  value = value.replace(/\s+(band|bands|group|orchestra|ensemble)$/u, "");
  value = value.replace(/\s+/g, " ").trim();
  return value;
}

/** Match key used for lookup; falls back to trimmed lowercase when normalize empties the string. */
export function artistMatchKey(raw: string): string {
  const normalized = normalizeArtistName(raw);
  if (normalized) return normalized;
  return raw.trim().toLowerCase();
}

export function artistNamesEquivalent(a: string, b: string): boolean {
  return artistMatchKey(a) === artistMatchKey(b);
}

export function findArtistIdByName(
  artists: Array<{ id: string; name: string }>,
  name: string,
): string | undefined {
  const exactKey = name.trim().toLowerCase();
  const exact = artists.find((artist) => artist.name.trim().toLowerCase() === exactKey);
  if (exact) return exact.id;

  const fuzzyKey = artistMatchKey(name);
  if (!fuzzyKey) return undefined;
  return artists.find((artist) => artistMatchKey(artist.name) === fuzzyKey)?.id;
}
