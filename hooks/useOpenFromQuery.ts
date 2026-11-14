"use client";

import { useEffect } from "react";

const OPEN_EVENT = "skatehive:open-from-query";

interface OpenDetail {
  param: string;
  value: string;
}

/** Dialogs that can be opened from a link, shared by the links and the pages. */
export const OPEN_TARGETS = {
  addSpot: { param: "add", value: "spot" },
  playDice: { param: "play", value: "dice" },
} as const satisfies Record<string, OpenDetail>;

/**
 * Opens a dialog when the page is loaded with `?<param>=<value>`, then drops
 * the param from the URL so a reload or a shared link doesn't reopen it.
 * Used by the mobile "+" sheet to land on /map?add=spot or /tricks?play=dice.
 *
 * Reads window.location instead of useSearchParams so the pages that use it
 * don't need a Suspense boundary. When the user is already on the page, the
 * page doesn't remount, so the sheet calls `requestOpenFromQuery` instead.
 */
export function useOpenFromQuery({ param, value }: OpenDetail, open: () => void) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(param) === value) {
      url.searchParams.delete(param);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      open();
    }

    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<OpenDetail>).detail;
      if (detail?.param === param && detail.value === value) open();
    };
    window.addEventListener(OPEN_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_EVENT, onRequest);
  }, [param, value, open]);
}

/** Asks a page that is already mounted to open the dialog behind `?param=value`. */
export function requestOpenFromQuery({ param, value }: OpenDetail) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail: { param, value } }));
}
