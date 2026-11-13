/**
 * Word lists for the rules. Kept deliberately small and conservative: a
 * rule that stays quiet when unsure beats one that cries wolf.
 */

/** Colour words, each mapped to a family. Words in one family never conflict. */
const EYE_COLOURS: Record<string, string> = {
  blue: "blue", "sky-blue": "blue", azure: "blue", sapphire: "blue",
  green: "green", emerald: "green", jade: "green",
  brown: "brown", dark: "brown", chocolate: "brown", "dark-brown": "brown",
  hazel: "hazel",
  grey: "grey", gray: "grey", silver: "grey", steel: "grey", "steel-grey": "grey",
  amber: "amber", golden: "amber", gold: "amber",
  black: "brown",
  violet: "violet", purple: "violet",
}

const HAIR_COLOURS: Record<string, string> = {
  blond: "blond", blonde: "blond", golden: "blond", fair: "blond", flaxen: "blond", "platinum": "blond",
  red: "red", ginger: "red", auburn: "red", copper: "red", "copper-red": "red", strawberry: "red",
  brown: "brown", chestnut: "brown", brunette: "brown", dark: "brown", "dark-brown": "brown", black: "brown",
  "raven": "brown", "jet-black": "brown", "ink-black": "brown",
  grey: "grey", gray: "grey", silver: "grey", white: "grey", "silver-grey": "grey",
}

export type Feature = "eyes" | "hair"

export const COLOURS: Record<Feature, Record<string, string>> = { eyes: EYE_COLOURS, hair: HAIR_COLOURS }

/** The colour families named in a profile field such as "pale green". Empty if none are recognised. */
export function colourFamilies(feature: Feature, value: string | undefined): Set<string> {
  const out = new Set<string>()
  if (!value) return out
  const table = COLOURS[feature]
  for (const word of value.toLowerCase().split(/[^a-z-]+/)) {
    if (table[word]) out.add(table[word])
    for (const part of word.split("-")) if (table[part]) out.add(table[part])
  }
  return out
}

/** Verbs that mean someone is speaking. */
export const SPEECH_VERBS = [
  "said", "says", "asked", "asks", "replied", "replies", "answered", "whispered", "shouted", "yelled",
  "muttered", "murmured", "called", "cried", "snapped", "added", "continued", "told", "tells", "laughed",
  "sighed", "admitted", "agreed", "insisted", "demanded", "explained",
]

/** Common verbs of present action. Past-tense "-ed" verbs are also recognised by shape. */
export const ACTION_VERBS = [
  "said", "says", "asked", "walked", "ran", "runs", "turned", "looked", "looks", "stood", "stands", "sat",
  "sits", "smiled", "smiles", "nodded", "shrugged", "grinned", "frowned", "laughed", "took", "takes",
  "came", "comes", "went", "goes", "stepped", "reached", "grabbed", "opened", "closed", "entered", "left",
  "leaned", "pulled", "pushed", "watched", "waved", "knocked", "kissed", "hugged", "held", "holds",
  "gave", "gives", "made", "makes", "knelt", "rose", "climbed", "drew", "threw", "caught", "spoke",
  "speaks", "wrote", "writes", "drove", "rode", "ate", "drank", "slept", "woke", "wakes", "answered",
  "replied", "whispered", "shouted", "muttered", "sighed", "is", "was",
]

/** "-ed" words that describe what happened TO someone, or memory, not something they do. */
export const NOT_ACTIONS = new Set([
  "died", "killed", "murdered", "buried", "mourned", "remembered", "missed", "loved", "named", "haunted",
  "beloved", "deceased", "departed", "wanted", "hanged", "executed", "drowned", "poisoned", "stabbed",
  "shot", "lost", "gone", "dead",
])

/** Words that show a dead character is being remembered, not present. */
export const MEMORY_CUES = [
  "remember", "remembered", "remembering", "memory", "memories", "used to", "would have", "dream",
  "dreamed", "dreamt", "ghost", "grave", "funeral", "buried", "mourn", "death", "dead", "died", "killed",
  "late", "portrait", "photo", "photograph", "letter", "diary", "once", "before she died", "before he died",
  "spirit", "vision", "imagined", "pictured", "missed", "miss",
]

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
  "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

/** "17", "seventeen", "twenty-one" → number; anything else → null. */
export function parseAge(word: string): number | null {
  const w = word.toLowerCase()
  if (/^\d{1,3}$/.test(w)) return Number(w)
  const one = ONES.indexOf(w)
  if (one >= 0) return one
  const [t, o] = w.split("-")
  const ten = TENS.indexOf(t)
  if (ten >= 2) {
    if (o === undefined) return ten * 10
    const unit = ONES.indexOf(o)
    if (unit >= 1 && unit <= 9) return ten * 10 + unit
  }
  return null
}

export const AGE_WORD = `(?:\\d{1,3}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|${ONES.slice(1).join("|")})`
