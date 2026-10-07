/**
 * Picks "Base N" where N is the lowest number >= start that no existing name
 * already uses. Replaces the old `count + 1` naming, which produced duplicate
 * names after a delete ("New Character 3" twice).
 */
export function nextDefaultName(
  existingNames: readonly string[],
  base: string,
  start = existingNames.length + 1
): string {
  const used = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  let n = Math.max(1, start);
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
