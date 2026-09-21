// A new script starts with this structure instead of a blank page —
// mirrors how poetry gets its own rhythm rules in the editor: different
// project types get a genuinely different starting shape, not just a
// different label. Structure follows the hook/setup/body/CTA pattern
// that's consistent across YouTube, podcast, and short-form scripting
// guidance: earn attention fast, promise the payoff, deliver value in
// ordered points, close with exactly one action.
// Average speaking pace for scripted video/podcast content — sourced from
// scripting guidance converging around 125-150 words per minute; 140 is
// the middle of that range.
const WORDS_PER_MINUTE = 140;

/** A rough spoken-runtime estimate from word count — "~2 min", "~45s". */
export function estimateScriptRuntime(wordCount: number): string {
  if (wordCount === 0) return "0 min";
  const minutes = wordCount / WORDS_PER_MINUTE;
  if (minutes < 1) {
    const seconds = Math.max(15, Math.round((minutes * 60) / 15) * 15);
    return `~${seconds}s`;
  }
  return `~${Math.round(minutes)} min`;
}

export const SCRIPT_SCAFFOLD = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Hook" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Earn the next 30 seconds. Name the problem or promise outright — skip \"hey guys, welcome back.\"",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Setup" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Validate the viewer's problem, promise the payoff, one line of credibility if it's earned.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Body" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "3–5 main points in ascending value order. One idea per section — cut anything that isn't purposeful.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Call to Action" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "One clear next action, not three. Match it to the video — a tutorial leads to another tutorial.",
        },
      ],
    },
  ],
};
