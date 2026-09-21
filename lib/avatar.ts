// A small set of muted, on-brand hues for the fallback avatar background —
// picked from the same family as the app's palette so a generated avatar
// never looks out of place next to a real profile photo.
const AVATAR_HUES = [25, 42, 145, 200, 260, 320] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** A stable oklch background color for this person — same every time, never "random per visit." */
export function avatarColor(seed: string): string {
  const hue = AVATAR_HUES[hashString(seed) % AVATAR_HUES.length];
  return `oklch(0.55 0.1 ${hue})`;
}

/** One or two initials from a name, falling back to the email's first letter. */
export function avatarInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
