// Adapted from mobileapp-main/lib/skate-sentences.ts
// Sentence/prompt strings are now in i18n locale files (skateDice.sentence* / skateDice.prompt*).
// This file exports only the counts and the pure "{t}" template splitter used by components.

export const SENTENCE_COUNT = 15;
export const PROMPT_COUNT = 3;

// Split a "{t}" template into text before and after the trick name token.
export function splitTemplate(template: string): { before: string; after: string } {
  const i = template.indexOf("{t}");
  if (i === -1) return { before: template, after: "" };
  return { before: template.slice(0, i), after: template.slice(i + 3) };
}
