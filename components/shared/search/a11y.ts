/**
 * Global search follows the WAI-ARIA combobox pattern: focus stays in the
 * input, the results are a listbox, and the input points at the highlighted
 * result through aria-activedescendant. These ids tie the pieces together.
 * https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 */
export const SEARCH_LISTBOX_ID = "global-search-listbox";

export function searchOptionId(index: number): string {
  return `global-search-option-${index}`;
}

export function searchSectionId(key: string): string {
  return `global-search-section-${key}`;
}
