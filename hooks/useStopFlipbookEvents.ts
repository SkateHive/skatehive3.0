"use client";

import { useEffect, useRef } from "react";

/**
 * Block native mouse/touch/pointer events on an element from bubbling up
 * to the react-pageflip flipbook (used by Magazine), which would otherwise
 * interpret taps on interactive media (play buttons, video controls) as
 * a page-flip gesture.
 *
 * Must use native addEventListener — React's delegated synthetic events
 * fire AFTER the native event has already bubbled past react-pageflip's
 * own native listeners on ancestor nodes.
 */
export function useStopFlipbookEvents<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const stop = (e: Event) => {
      e.stopPropagation();
    };

    const events: (keyof HTMLElementEventMap)[] = [
      "mousedown",
      "mouseup",
      "click",
      "pointerdown",
      "pointerup",
      "touchstart",
      "touchend",
    ];

    events.forEach((ev) => el.addEventListener(ev, stop));
    return () => {
      events.forEach((ev) => el.removeEventListener(ev, stop));
    };
  }, []);

  return ref;
}
