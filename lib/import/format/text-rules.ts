/** Small judgments about text that Step 5's builders share. */

const firstLetter = (t: string) => t.match(/\p{L}/u)?.[0] ?? "";

export const startsLower = (t: string) => /\p{Ll}/u.test(firstLetter(t));
/** The first letter has no upper/lower case at all (Devanagari, Arabic, CJK…), so case can't tell a continuation from a new line. */
export const startsCaseless = (t: string) => {
  const c = firstLetter(t);
  return c !== "" && !/\p{Lu}|\p{Ll}/u.test(c);
};
export const startsUpper = (t: string) => /\p{Lu}/u.test(firstLetter(t));

/** Ends a sentence (allowing a closing quote or bracket after the mark). */
export const endsSentence = (t: string) => /[.!?।॥…]["”’')\]]*\s*$/u.test(t);

/** "ex-" at a line end followed by "ample" on the next: a word the typesetter hyphenated. */
export function isLineEndHyphen(prev: string, next: string): boolean {
  return /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(next);
}
