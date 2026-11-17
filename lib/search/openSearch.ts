/**
 * The global search overlay lives in RootLayoutClient, far from the nav
 * components that need a button for it. They fire this event instead of
 * threading a setter through every layout; RootLayoutClient listens for it.
 */
export const OPEN_SEARCH_EVENT = "skatehive:open-search";

export function openGlobalSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
