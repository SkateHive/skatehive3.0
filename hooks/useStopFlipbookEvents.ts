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
 *
 * Only the *gesture-start* events are stopped (mousedown / pointerdown /
 * touchstart). react-pageflip uses those to begin drag tracking, so
 * blocking them is sufficient to prevent a flip. Crucially we let `click`,
 * `mouseup`, `pointerup`, and `touchend` propagate — React's event
 * delegation lives on the root container in React 17+, so stopping the
 * native click here would prevent React's `onClick` from ever firing
 * (which was breaking the 3Speak / YouTube click-to-play posters).
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
      "pointerdown",
      "touchstart",
    ];

    events.forEach((ev) => el.addEventListener(ev, stop));
    return () => {
      events.forEach((ev) => el.removeEventListener(ev, stop));
    };
  }, []);

  return ref;
}
