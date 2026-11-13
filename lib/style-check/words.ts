/**
 * Word lists for the style heuristics. Kept short and conservative: a
 * missed adverb costs less than a false alarm on every page.
 */

/** Words never flagged as repeats: function words, pronouns, speech tags and common verbs. */
export const REPEAT_SKIP = new Set(
  `a an the and or but nor so yet for of to in on at by with from into onto upon over under about above below
  after before since until while as than then there here this that these those what which who whom whose when
  where why how all any both each few more most other some such no not only own same too very can will just
  i me my mine myself you your yours yourself he him his himself she her hers herself it its itself we us our
  ours ourselves they them their theirs themselves one ones am is are was were be been being have has had
  having do does did doing would should could might must shall may said says say asked ask told tell like
  back out up down off again once even still now well also its it's i'm don't didn't wasn't couldn't
  wouldn't can't won't that's he's she's they're we're you're i'd i'll mr mrs ms dr`
    .split(/\s+/)
    .filter(Boolean)
)

/** "-ly" words that aren't adverbs, or are too plain to flag. */
export const ADVERB_SKIP = new Set(
  `only early family reply supply apply ally rally tally folly belly jelly bully gully holy ugly silly
  chilly hilly curly daily weekly monthly yearly hourly nightly elderly friendly lonely lovely lively
  costly deadly likely unlikely oily fly butterfly rely comply imply multiply july italy assembly anomaly
  homily lily emily molly sally holly polly kelly jolly melancholy monopoly wily surly burly comely
  ghostly ghastly orderly cowardly worldly heavenly beastly bodily kindly manly womanly motherly
  fatherly brotherly sisterly scholarly timely untimely leisurely stately sickly prickly wrinkly
  crinkly bubbly cuddly smelly woolly jelly gravelly reply italy firefly dragonfly`
    .split(/\s+/)
    .filter(Boolean)
)

/** Past participles that don't end in "-ed". */
export const IRREGULAR_PARTICIPLES = new Set(
  `been born borne beaten become begun bent bound bitten bled blown broken bred brought built burnt bought
  caught chosen come cut dealt done drawn driven drunk eaten fallen fed felt fought found fled flung
  forbidden forgotten forgiven frozen given gone ground grown hung heard hidden hit held hurt kept known
  laid led left lent let lain lit lost made meant met paid put read ridden rung risen run said seen sought
  sold sent set shaken shed shot shown shut sung sunk sat slain slept slung spoken spent spun split spread
  stolen stuck stung struck strung sworn swept swum swung taken taught torn told thought thrown understood
  woken worn woven won wound written`
    .split(/\s+/)
    .filter(Boolean)
)

/**
 * "-ed" words that after "was/were" usually describe a state, not an
 * action done to someone ("she was tired", "he was interested").
 */
export const STATE_ADJECTIVES = new Set(
  `tired interested bored excited scared worried married used supposed pleased surprised annoyed amazed
  ashamed confused convinced determined disappointed embarrassed exhausted frightened prepared relieved
  satisfied shocked terrified thrilled upset concerned involved related located based aged armed
  dressed naked crowded tied twisted cursed blessed sacred wicked rugged jagged ragged crooked learned
  beloved accustomed alarmed amused annoyed astonished delighted depressed devoted disgusted distracted
  dazed drunk exhausted fascinated horrified impressed inclined irritated overwhelmed puzzled qualified
  stunned startled stressed talented tanned tangled unarmed unexpected unmarried unprepared unsettled
  wasted wounded`
    .split(/\s+/)
    .filter(Boolean)
)

/** Forms of "to be" that start a passive. */
export const BE_FORMS = ["am", "is", "are", "was", "were", "be", "been", "being", "get", "gets", "got", "gotten", "getting"]

/** Verbs that mark a dialogue tag ("said Mara", "Mara whispered"). */
export const SPEECH_VERBS = new Set(
  `said says say asked asks replied replies whispered whispers shouted shouts muttered mutters called calls
  answered answers cried cries added adds murmured murmurs snapped snaps yelled yells told tells began
  continued continues insisted insists admitted admits laughed laughs sighed sighs breathed hissed growled
  demanded demands explained explains agreed agrees protested warned warns repeated repeats exclaimed
  mumbled mumbles screamed screams stammered roared barked offered suggested pleaded begged teased
  grumbled whimpered sobbed shrieked chuckled snarled retorted interrupted announced declared noted
  observed remarked`
    .split(/\s+/)
    .filter(Boolean)
)
